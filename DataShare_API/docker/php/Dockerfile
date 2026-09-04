FROM php:8.4-fpm AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
        libicu-dev \
        libpq-dev \
        libzip-dev \
        unzip \
    && docker-php-ext-configure intl \
    && docker-php-ext-install -j"$(nproc)" intl opcache pdo_pgsql zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/php/conf.d/uploads.ini $PHP_INI_DIR/conf.d/uploads.ini

WORKDIR /srv/app

FROM base AS dev

RUN apt-get update && apt-get install -y --no-install-recommends $PHPIZE_DEPS \
    && pecl install pcov \
    && docker-php-ext-enable pcov \
    && rm -rf /var/lib/apt/lists/*

FROM base AS prod

COPY . .
RUN composer install --no-dev --no-interaction --optimize-autoloader --no-scripts
