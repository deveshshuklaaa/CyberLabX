FROM cyberlabx-kali:latest

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       dnsutils \
       traceroute \
       whois \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY files/recon-osint /usr/local/bin/recon-osint
RUN chmod +x /usr/local/bin/recon-osint

CMD ["/bin/bash"]
