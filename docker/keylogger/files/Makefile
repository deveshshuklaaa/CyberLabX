CC = gcc
CFLAGS = -Wall -Wextra -O2

all: skeylogger

skeylogger: skeylogger.c
	$(CC) $(CFLAGS) -o skeylogger skeylogger.c

clean:
	rm -f skeylogger skeylogger.log /tmp/.lab_keyboard_pipe

.PHONY: all clean
