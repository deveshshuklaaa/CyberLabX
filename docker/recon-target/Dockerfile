FROM alpine:3.20

RUN apk add --no-cache busybox-extras lighttpd dnsmasq \
    && mkdir -p /var/www/localhost/htdocs /etc/dnsmasq.d \
    && printf '%s\n' '<!doctype html><title>Somaiya Recon Target</title><h1>Controlled Reconnaissance Target</h1><p>Somaiya Vidyavihar University</p>' > /var/www/localhost/htdocs/index.html

COPY files/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80 53/udp 53/tcp

HEALTHCHECK --interval=5s --timeout=3s --retries=5 \
    CMD nc -z 127.0.0.1 80 || exit 1

CMD ["/start.sh"]
