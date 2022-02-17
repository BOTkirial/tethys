from nginx

COPY . /usr/share/nginx/html
WORKDIR /usr/share/nginx/html

RUN apt-get update && apt-get install -y curl \
    && curl --silent --location https://deb.nodesource.com/setup_12.x | bash - \
    && apt-get install -y nodejs \
    && apt-get install nano \
    && npm install \
    && npm run build \
    && rm -r node_modules res \ 
    && mv -v /usr/share/nginx/html/dist/* /usr/share/nginx/html \