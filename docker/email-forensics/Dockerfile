FROM cyberlabx-kali:latest

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       bulk-extractor \
       ripmime \
       libimage-exiftool-perl \
       whois \
       file \
       coreutils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /root/EmailForensics/evidence /root/EmailForensics/attachments /root/EmailForensics/output /root/EmailForensics/results \
    && mkdir -p /home/student/EmailForensics/evidence /home/student/EmailForensics/attachments /home/student/EmailForensics/output /home/student/EmailForensics/results \
    && mkdir -p /var/evidence

COPY files/email_sample.eml /root/EmailForensics/evidence/email_sample.eml
COPY files/email_sample.eml /home/student/EmailForensics/evidence/email_sample.eml
COPY files/email_sample.eml /var/evidence/email_sample.eml

WORKDIR /root/EmailForensics

CMD ["/bin/bash"]
