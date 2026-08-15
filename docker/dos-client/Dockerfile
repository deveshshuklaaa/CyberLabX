FROM alpine:3.20
RUN apk add --no-cache curl
COPY files/start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]
