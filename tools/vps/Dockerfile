# Glitch.TEC — PHP + Apache para el VPS (ver tools/LEEME_despliegue.md)
FROM php:8.3-apache

# pdo_mysql para la API; AllowOverride All para que Apache lea el .htaccess del juego
RUN docker-php-ext-install pdo_mysql \
 && sed -i 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf \
 && a2enmod rewrite
