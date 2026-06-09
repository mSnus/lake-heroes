FROM php:8.3-fpm-alpine

# Fast, reliable PHP extension installation (handles build deps + cleanup).
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
RUN chmod +x /usr/local/bin/install-php-extensions && \
    install-php-extensions pdo_mysql

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html
