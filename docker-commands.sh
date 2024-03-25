# Running and building site
sudo docker run --rm -v "$PWD:/srv/jekyll" -p 4000:4000 -it --entrypoint sh jekyll/jekyll -c "gem install rouge jekyll-default-layout liquid-md5 webrick && jekyll serve --incremental"
sudo docker run --rm -v "$PWD:/srv/jekyll" -p 4000:4000 -it --entrypoint sh jekyll/jekyll -c "gem install rouge jekyll-default-layout liquid-md5 webrick && jekyll build"

# Pushing changes to gh-pages branch
cd _site
git add .
git cm "Jekyll _site build"
git push
