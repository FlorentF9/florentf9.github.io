docker run --rm -v "$PWD:/srv/jekyll" -p 4000:4000 -it jekyll/jekyll sh
gem install rouge jekyll-default-layout liquid-md5
jekyll build

jekyll serve --incremental


git checkout gh-pages