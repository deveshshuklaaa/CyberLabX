FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends bash curl hping3 tshark iputils-ping iproute2 net-tools python3 ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash student

COPY files/ /usr/local/lib/cyberlabx/
RUN chmod 755 /usr/local/lib/cyberlabx/start.sh /usr/local/lib/cyberlabx/dos-service.py /usr/local/lib/cyberlabx/dos-sim /usr/local/lib/cyberlabx/tshark \
    && ln -s /usr/local/lib/cyberlabx/dos-sim /usr/local/bin/dos-sim \
    && ln -s /usr/local/lib/cyberlabx/tshark /usr/local/bin/tshark

CMD ["/usr/local/lib/cyberlabx/start.sh"]
