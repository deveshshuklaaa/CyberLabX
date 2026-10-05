FROM cyberlabx-kali:latest

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       testdisk \
       photorec \
       e2fsprogs \
       file \
       coreutils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /root/disk_forensics/evidence /home/student/disk_forensics/evidence

COPY files/evidence/confidential.txt /root/disk_forensics/evidence/confidential.txt
COPY files/evidence/experiment.txt /root/disk_forensics/evidence/experiment.txt
COPY files/evidence/students.csv /root/disk_forensics/evidence/students.csv

COPY files/evidence/confidential.txt /home/student/disk_forensics/evidence/confidential.txt
COPY files/evidence/experiment.txt /home/student/disk_forensics/evidence/experiment.txt
COPY files/evidence/students.csv /home/student/disk_forensics/evidence/students.csv

# Build the 64MB synthetic ext4 source disk image and populate evidence files
RUN dd if=/dev/zero of=/root/disk_forensics/source_disk.img bs=1M count=64 \
    && mkfs.ext4 -F /root/disk_forensics/source_disk.img \
    && debugfs -w -R "write /root/disk_forensics/evidence/confidential.txt confidential.txt" /root/disk_forensics/source_disk.img \
    && debugfs -w -R "write /root/disk_forensics/evidence/experiment.txt experiment.txt" /root/disk_forensics/source_disk.img \
    && debugfs -w -R "write /root/disk_forensics/evidence/students.csv students.csv" /root/disk_forensics/source_disk.img \
    && cp /root/disk_forensics/source_disk.img /home/student/disk_forensics/source_disk.img

COPY files/forensic-recover /usr/local/bin/forensic-recover
RUN chmod +x /usr/local/bin/forensic-recover

WORKDIR /root/disk_forensics

CMD ["/bin/bash"]
