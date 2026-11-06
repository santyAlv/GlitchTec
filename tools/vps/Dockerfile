# Glitch.TEC — PHP + Apache para el VPS (ver tools/LEEME_despliegue.md)
FROM php:8.3-apache

# pdo_mysql y pdo_pgsql (Supabase) para la API; AllowOverride All para el .htaccess
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev \
 && docker-php-ext-install pdo_mysql pdo_pgsql \
 && rm -rf /var/lib/apt/lists/* \
 && sed -i 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf \
 && a2enmod rewrite \
 && printf 'SetEnvIf X-Forwarded-Proto "^https$" HTTPS=on\n' > /etc/apache2/conf-enabled/detras-de-traefik.conf

# Lo de arriba: el HTTPS lo termina Traefik y a Apache le llega HTTP plano.
# Con HTTPS=on PHP sabe que la conexión del jugador fue cifrada y la cookie de
# sesión sale con Secure (ver sesion_iniciar en api/auth.php). Sólo Traefik
# llega al contenedor, así que nadie más puede mandar ese encabezado.
