# Ashfield CalDAV: Sabre/DAV PHP 서버 (ADR-0014)
#
# nginx (앞단) → fastcgi → php-fpm → server.php → Sabre Server
# DB 는 우리 backend 와 공유 (PostgreSQL).

FROM php:8.2-fpm-alpine AS base

RUN apk add --no-cache postgresql-dev libpq && \
    docker-php-ext-install pdo pdo_pgsql opcache && \
    apk del --purge postgresql-dev

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json /app/
RUN composer install --no-dev --no-interaction --no-progress --optimize-autoloader

COPY src/ /app/src/
COPY public/ /app/public/

# PHP-FPM 설정: alpine 이미지 기본 설정은 listen=127.0.0.1:9000 + www pool
# 우리는 nginx 가 같은 컨테이너에 없으니 0.0.0.0:9000 로 변경
RUN sed -i 's|listen = 127.0.0.1:9000|listen = 0.0.0.0:9000|' /usr/local/etc/php-fpm.d/www.conf && \
    sed -i 's|;clear_env = no|clear_env = no|' /usr/local/etc/php-fpm.d/www.conf

EXPOSE 9000
CMD ["php-fpm", "-F"]
