FROM alpine:3.20
RUN apk add --no-cache busybox-extras lighttpd \
    && mkdir -p /var/www/localhost/htdocs \
    && printf '%s\n' '<!doctype html><title>CyberLabX DoS Analysis Target</title><h1>CyberLabX DoS Analysis Target</h1>' > /var/www/localhost/htdocs/index.html
COPY files/start.sh /start.sh
RUN chmod +x /start.sh
HEALTHCHECK --interval=5s --timeout=3s --retries=5 CMD nc -z 127.0.0.1 80 || exit 1
CMD ["/start.sh"]
