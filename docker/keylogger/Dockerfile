FROM cyberlabx-kali:latest

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       gcc \
       make \
       libc6-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /root/skeylogger /home/student/skeylogger

COPY files/skeylogger.c /root/skeylogger/
COPY files/Makefile /root/skeylogger/
COPY files/skeylogger.c /home/student/skeylogger/
COPY files/Makefile /home/student/skeylogger/

COPY files/lab-test-input /usr/local/bin/lab-test-input
RUN chmod +x /usr/local/bin/lab-test-input

WORKDIR /root/skeylogger

CMD ["/bin/bash"]
