FROM cyberlabx-kali:latest

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       xxd \
       file \
       coreutils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /root/file_forensics/original /root/file_forensics/working /root/file_forensics/recovered \
    && mkdir -p /home/student/file_forensics/original /home/student/file_forensics/working /home/student/file_forensics/recovered

COPY files/disguised_image.sys /root/file_forensics/original/disguised_image.sys
COPY files/disguised_image.sys /root/file_forensics/working/disguised_image.sys
COPY files/disguised_image.sys /home/student/file_forensics/original/disguised_image.sys
COPY files/disguised_image.sys /home/student/file_forensics/working/disguised_image.sys

WORKDIR /root/file_forensics

CMD ["/bin/bash"]
