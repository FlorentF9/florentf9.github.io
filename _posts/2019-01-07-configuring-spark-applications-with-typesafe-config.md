---
layout: post
title: Configuring Spark applications with Typesafe Config
permalink: :year/:month/:day/:title:output_ext
categories: 
    - tutorial
    - scala
    - spark
post: true
---

Complex and generic Spark applications often require input from the user, in order to specify application parameters or the data sources the application should work with. Using command-line arguments is limited. Lightbend's **[config](https://github.com/lightbend/config)** library allows to use configuration files in applications written in JVM languages, including Spark applications written in Scala.

Example code for this post is [available on Github](https://github.com/FlorentF9/spark-config-example).

* TOC
{:toc}

# Configuration files VS command-line arguments

One solution is to use command-line arguments when submitting the application with `spark-submit`. In case of a Scala Spark application packaged as a JAR, command-line arguments are given at the end of the command, as follows:

```shell
$ spark-submit [...] myApplication.jar arg1 arg2 arg3
```

Then, they can be read from within the `main` method of the application using the `args` variable. It works similarly in Python for a pyspark application. Command-line arguments work for a small number of simple parameters, but has several disadvantages, as a user:

* Unpractical if there are many arguments (unless you like veeery looong shell commands) and typos are hard to spot
* Arguments are not named and only identified by their position
* You WILL enter the arguments in the wrong order
* No optional arguments
* It is difficult or not possible to provide complex arguments (e.g. arrays, strings with spaces, structured types, etc.)

...and as a developer:

* All arguments are considered strings and must be cast to the correct type
* No possibility of managing optional arguments and default values
* Handling errors (e.g. missing arguments, wrong order or format) is tedious
* and above all, **reproducibility**: how will you remember with what arguments you submitted that job last week? Ok, you could copy-paste the shell commands into files. But hey, that's what configuration files are for! A configuration file can be easily put under version control: configuration-as-code!

Lightbend's **[config](https://github.com/lightbend/config)** library allows to use configuration files in applications written in JVM languages, including Spark applications written in Scala. It solves all problems listed above, and offers many more useful features. The config library itself is written in Java and can be easily imported in a Scala project. Before going further, here is the link to the [package Java documentation](https://lightbend.github.io/config/latest/api/com/typesafe/config/package-summary.html).

# Minimal example

I will first present a minimalistic application that will serve as an example throughout this post. It performs a word count on a text file, filtering out stop words and words with too few occurrences, and outputs the ordered word counts in a CSV file.

In the first version of the application, input and output file names are given as string arguments, the third argument is the minimum number of occurrences to keep a word and the last one is an array of strings containing the stop words that will not be counted. This application can be called as follows:

```shell
$ spark-submit --master local[*] --class xyz.florentforest.sparkconfigexample.CmdWordCount target/scala-2.11/sparkconfigexample-assembly-1.0.jar
document.txt output-cmd 3 ["for","in","is","on","the","a","to","and","an","of","if","with","you","or","also","##",\"\"]
```

The Spark code is printed here:

```scala
import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.functions.{col, not, lower, desc}
import org.apache.log4j.{LogManager, Level}

object CmdWordCount {
    def main(args: Array[String]) {
        // Read command-line arguments
        // (ok, you could do better and write a dedicated function or use an external library for argument parsing)
        val inputFile: String = args(0)
        val outputFile: String = args(1)
        val minCount: Int = args(2).toInt
        val stopWords: Array[String] = args(3).stripPrefix("[").stripSuffix("]")
                                              .split(",")
                                              .map(_.stripPrefix("\"").stripSuffix("\""))

        val spark: SparkSession = SparkSession.builder()
                                              .appName("Word Count (cmd)")
                                              .getOrCreate()
        import spark.implicits._

        // Business logic
        val document = spark.read.textFile(inputFile)
        val result   = document.flatMap(_.split(" "))
                               .filter(not(lower(col("value")).isin(stopWords: _*)))
                               .groupBy("value")
                               .count()
                               .filter(col("count") >= minCount)
                               .orderBy(desc("count"))
        result.coalesce(1).write.csv(outputFile)

        spark.stop()
    }
}
```

Note that arguments had to be cast and parsed manually (e.g. using `toInt` and `split`). In particular, the empty string `""` in the stop words had to be escaped (`\"\"`) because else, the double quotes will be dropped. 

# Quick set-up of config

The aim of this post is not to provide a comprehensive user guide for config. This information can be found on the Github page and in the official documentation (useful links are listed in the last section). I will just show a quick minimal set-up to get your Spark application running with config in local mode and on a YARN cluster.

Here is the line to add config to your sbt build file in its current version (I personnally use sbt but the library can also be imported with maven or downloaded manually):

```sbt
"com.typesafe" % "config" % "1.3.2"

```

In the application, the configuration is an instance of the `Config` class, loaded using the `ConfigFactory` class. Without arguments, it loads the configuration file from its default location (*application.conf*), but we will soon see how to specify the file to the Spark driver and executors.

```scala
import com.typesafe.config.{Config, ConfigFactory}
val conf: Config = ConfigFactory.load()
```

# Configuration file

Here's our simple configuration file, named *wordcount.conf*:

```
file.input  = "document.txt"
file.output = "output-config"
minCount    = 3
stopWords   = ["for", "in", "is", "on", "the", "a", "to", "and", "an", "of", "if", "with", "you", "or", "also", "##", ""]
```

It consists in a field with two sub-fields for the input and output filenames, an integer field and a list of strings, written in simple JSON syntax.

# Settings class

Configuration parameters are accessed using typed getter methods and the _path_ of the parameter. A common solution, recommended by the developers of config, is to create a custom class that will load the configuration and hold the parameter variables, named for example `Settings`. The advantage is that (1) all the parsing logic is done in this class and not along our business logic, (2) by loading variables as non-lazy fields, all exceptions triggered by the parsing of the configuration file will occur at the very beginning and not after the job has been running for an hour. Here is the `Settings` class used in the example project:

```scala
import com.typesafe.config.Config
import scala.collection.JavaConverters._

class Settings(config: Config) extends Serializable {
    val inputFile = config.getString("file.input")
    val outputFile = config.getString("file.output")

    val minCount = config.getInt("minCount")
    val stopWords = config.getStringList("stopWords").asScala
}
```

In practice, a lot of stuff happens in this class, for example handling optional or complex types. You will often have to use `scala.collection.JavaConverters` or `scala.collection.JavaConversions` for converting between Java and Scala types, because config is a Java library. More to this topic in the Additional remarks section.

# Code with config

Finally, here is the code of our example application using our configuration file, via the `Settings` class:

```scala
import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.functions.{col, not, lower, desc}
import com.typesafe.config.{Config, ConfigFactory}

object ConfigWordCount {
    def main(args: Array[String]) {
        // Load configuration into Settings class
        val conf: Config = ConfigFactory.load()
        val settings: Settings = new Settings(conf)

        val spark: SparkSession = SparkSession.builder()
                                              .appName("Word Count (config)")
                                              .getOrCreate()
        import spark.implicits._

        // Business logic
        val document = spark.read.textFile(settings.inputFile)
        val result   = document.flatMap(_.split(" "))
                               .filter(not(lower(col("value")).isin(settings.stopWords: _*)))
                               .groupBy("value")
                               .count()
                               .filter(col("count") >= settings.minCount)
                               .orderBy(desc("count"))
        result.coalesce(1).write.csv(settings.outputFile)

        spark.stop()
    }
}
```

# Running local and on YARN

When submitting the job, no matter if in local mode or in YARN client or cluster mode, the driver or executors need to be able to access the configuration file. Otherwise, there are two possibilities:

1. If the application was built with a reference configuration file (*reference.conf*) in the *src/main/resources* directory, this one will be used as a default.
2. Else, you will get the following exception, telling that config cannot find the key *file.input* we tried to access:

```
Exception in thread "main" com.typesafe.config.ConfigException$Missing: No configuration setting found for key 'file.input'
```

Several arguments to `spark-submit` are needed to provide the configuration file, depending on the deploy mode. We will address local mode and YARN client and cluster mode.

## local

```shell 
$ spark-submit --master local[*] [...] --files application.conf --driver-java-options -Dconfig.file=application.conf myApplication.jar
```

The *--files* argument allows to ship files with the application code, and the driver java option tells config (running in the driver) the path of our file. For the example application, the command is:

```shell
$ spark-submit --master local[*] --class xyz.florentforest.sparkconfigexample.ConfigWordCount --files wordcount.conf
--driver-java-options -Dconfig.file=wordcount.conf sparkconfigexample-assembly-1.0.jar 
```

## YARN client mode

```shell 
$ spark-submit --master yarn --deploy-mode client [...] --files application.conf --driver-java-options -Dconfig.file=application.conf
--conf spark.executor.extraJavaOptions=-Dconfig.file=application.conf myApplication.jar
```

In YARN client mode, we need to add the java option for the executors using the correspondig Spark configuration variable *spark.executor.extraJavaOptions*. Thus, for our example we have:

```shell
$ spark-submit --master yarn --deploy-mode client --class xyz.florentforest.sparkconfigexample.ConfigWordCount --files wordcount.conf
--driver-java-options -Dconfig.file=wordcount.conf --conf spark.executor.extraJavaOptions=-Dconfig.file=wordcount.conf sparkconfigexample-assembly-1.0.jar 
```

## YARN cluster mode

```shell 
$ spark-submit --master yarn --deploy-mode cluster  [...] --files application.conf --conf spark.driver.extraJavaOptions=-Dconfig.file=application.conf
--conf spark.executor.extraJavaOptions=-Dconfig.file=application.conf myApplication.jar
```

In cluster mode, the command is the same, excepted that we must use *spark.driver.extraJavaOptions* instead of *--driver-java-options*.

```shell
$ spark-submit --master yarn --deploy-mode cluster --class xyz.florentforest.sparkconfigexample.ConfigWordCount --files wordcount.conf
--conf spark.driver.extraJavaOptions=-Dconfig.file=wordcount.conf --conf spark.executor.extraJavaOptions=-Dconfig.file=wordcount.conf sparkconfigexample-assembly-1.0.jar 
```

# Additional remarks

The config library has a lot of features that are not displayed in this minimalistic example and are not the point of this post. I will cite some of them:

* projects can be built with a default reference configuration named *reference.conf*. Validity of a configuration can be checked against the reference configuration.
* variables in the configuration file can be nested structured objects with JSON syntax (or if you prefer, like Python dictionaries). I use this a lot in my projects.
* the JSON and dot syntaxes can be mixed
* you can use special syntaxes to refer to other configuration variables or even system environment variables
* handling optional arguments (with Scala's `Option` type) is explained in the library's README

See the doc for more!

Another important point is the conversion between Java and Scala objects. You will often have to use conversions between Java and Scala types, either using `.asScala` implicits defined in `scala.collection.JavaConverters`, or conversions from `scala.collection.JavaConversions`. When you combine complex types such as lists and JSON maps, conversions can get tricky and you sometimes have to extract the underlying Java objects (there's a method of the Config class called `underlying`) and convert them manually using `.asInstanceOf[...]`. Be careful, as it leads to potential runtime errors! This is a drawback of using a Java library in Scala. Note that someone wrote a [wrapper of config in pure Scala](https://github.com/andr83/scalaconfig), I did not have time to try it but it might be the perfect fit.

# References

Example project:
* [https://github.com/FlorentF9/spark-config-example](https://github.com/FlorentF9/spark-config-example)

Github projects:
* [https://github.com/lightbend/config](https://github.com/lightbend/config)
* [https://github.com/andr83/scalaconfig](https://github.com/andr83/scalaconfig)

Documentation:
* [https://lightbend.github.io/config/latest/api/com/typesafe/config/package-summary.html](https://lightbend.github.io/config/latest/api/com/typesafe/config/package-summary.html)
* [https://spark.apache.org/docs/latest/configuration.html#runtime-environment](https://spark.apache.org/docs/latest/configuration.html#runtime-environment)

Related StackOverflow questions:
* [https://stackoverflow.com/questions/28166667/how-to-pass-d-parameter-or-environment-variable-to-spark-job](https://stackoverflow.com/questions/28166667/how-to-pass-d-parameter-or-environment-variable-to-spark-job)
* [https://stackoverflow.com/questions/40507436/using-typesafe-config-with-spark-on-yarn](https://stackoverflow.com/questions/40507436/using-typesafe-config-with-spark-on-yarn)
* [https://stackoverflow.com/questions/48315355/reading-a-config-file-which-is-placed-on-my-linux-node-in-scala](https://stackoverflow.com/questions/48315355/reading-a-config-file-which-is-placed-on-my-linux-node-in-scala)
