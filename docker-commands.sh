sudo docker run --rm -v "$PWD:/srv/jekyll" -p 4000:4000 -it jekyll/jekyll sh
gem install rouge jekyll-default-layout liquid-md5 webrick
jekyll build
jekyll serve --incremental


sudo docker run --rm -v $(pwd):/srv/jekyll -p 4000:4000 -it website jekyll build
cd _site
git checkout gh-pages
git add .
git cm "Jekyll _site build"
git push
