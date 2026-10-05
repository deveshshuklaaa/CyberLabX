/*
 * Somaiya Virtual Labs — Educational Keylogger (skeylogger)
 * For Academic Instruction and Threat Analysis Only.
 *
 * Safe Laboratory Implementation: Operates strictly within a private disposable container.
 * Intercepts synthetic/lab input events without accessing host input devices.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <signal.h>

#define FIFO_PATH "/tmp/.lab_keyboard_pipe"
#define LOG_FILE "skeylogger.log"
#define MAX_BUFFER 4096

static volatile int keep_running = 1;

void handle_signal(int sig) {
    (void)sig;
    keep_running = 0;
}

void get_timestamp(char *buffer, size_t max_len) {
    time_t raw = time(NULL);
    struct tm *info = localtime(&raw);
    strftime(buffer, max_len, "%Y-%m-%d %H:%M:%S", info);
}

int main(int argc, char *argv[]) {
    printf("====================================================\n");
    printf(" SOMAIYA VIRTUAL LABS — SKEYLOGGER (EDUCATIONAL)\n");
    printf(" Status: Active Keystroke Interceptor\n");
    printf(" Target: Laboratory Virtual Input Stream\n");
    printf(" Log destination: %s\n", LOG_FILE);
    printf("====================================================\n");

    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);

    // Create named pipe for lab input simulation if not present
    unlink(FIFO_PATH);
    if (mkfifo(FIFO_PATH, 0666) == -1) {
        perror("[!] mkfifo failed");
    }

    FILE *log = fopen(LOG_FILE, "a");
    if (!log) {
        perror("[!] Unable to open log file");
        return 1;
    }

    char ts[64];
    get_timestamp(ts, sizeof(ts));
    fprintf(log, "\n--- SKEYLOGGER SESSION STARTED [%s] ---\n", ts);
    fflush(log);

    printf("[+] skeylogger listening for laboratory keystrokes...\n");
    printf("[+] Run 'lab-test-input <test_string>' to simulate user input.\n\n");
    fflush(stdout);

    char full_captured[MAX_BUFFER] = {0};
    int captured_len = 0;

    while (keep_running) {
        int fd = open(FIFO_PATH, O_RDONLY);
        if (fd < 0) {
            usleep(100000);
            continue;
        }

        char ch;
        while (read(fd, &ch, 1) > 0) {
            get_timestamp(ts, sizeof(ts));

            if (ch == '\n' || ch == '\r') {
                if (captured_len > 0) {
                    fprintf(log, "[%s] [ENTER] CAPTURED BUFFER: \"%s\"\n", ts, full_captured);
                    printf("[skeylogger] Intercepted entry: \"%s\"\n", full_captured);
                    fflush(log);
                    fflush(stdout);
                    memset(full_captured, 0, sizeof(full_captured));
                    captured_len = 0;
                }
            } else if (ch >= 32 && ch <= 126) {
                fprintf(log, "[%s] KEY_DOWN: '%c' (ASCII %d)\n", ts, ch, (int)ch);
                fflush(log);
                if (captured_len < MAX_BUFFER - 1) {
                    full_captured[captured_len++] = ch;
                    full_captured[captured_len] = '\0';
                }
            }
        }
        close(fd);
    }

    get_timestamp(ts, sizeof(ts));
    fprintf(log, "--- SKEYLOGGER SESSION TERMINATED [%s] ---\n", ts);
    fclose(log);
    unlink(FIFO_PATH);
    printf("\n[+] skeylogger terminated cleanly. Log written to %s.\n", LOG_FILE);
    return 0;
}
