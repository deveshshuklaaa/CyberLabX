FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       nmap \
       libcap2-bin \
       iputils-ping \
       iproute2 \
       net-tools \
       curl \
       ca-certificates \
       bash \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && setcap -r /usr/lib/nmap/nmap

CMD ["/bin/bash"]