import bcrypt from 'bcrypt';
import { connectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import {
  Experiment,
  DOS_LAB_DEFINITION,
  NMAP_LAB_DEFINITION,
  RECON_LAB_DEFINITION,
  KEYLOGGER_LAB_DEFINITION,
  EMAIL_FORENSICS_LAB_DEFINITION,
  FILE_FORENSICS_LAB_DEFINITION,
  DISK_FORENSICS_LAB_DEFINITION,
} from '../models/Experiment.js';

const accounts = [
  ['SEED_ADMIN_EMAIL', 'admin', 'System', 'Administrator'],
  ['SEED_FACULTY_EMAIL', 'faculty', 'Lab', 'Instructor'],
  ['SEED_STUDENT_EMAIL', 'student', 'Demo', 'Student'],
] as const;

/* ── Exp 02: Network Mapping using Nmap (Existing / Preserved) ── */
const nmapExperiment = {
  title: 'Network Mapping using Nmap',
  slug: 'network-mapping-nmap',
  description: 'Map a controlled private network and interpret real Nmap findings without scanning public systems.',
  aim: 'Use Nmap to discover and identify the intentionally configured services on a private CyberLabX target.',
  objectives: [
    'Perform host discovery in a private lab network.',
    'Run and interpret TCP SYN scans.',
    'Identify a target operating system using Nmap.',
    'Detect network services and their versions.',
  ],
  theorySections: [
    {
      title: 'Network mapping',
      content: 'Network mapping builds an inventory of reachable hosts, ports, services, and operating-system clues. In this lab every scan must stay inside the disposable private network.',
    },
    {
      title: 'Nmap scan types',
      content: 'Nmap uses different probes for discovery, TCP SYN scanning, version detection, and OS fingerprinting. Combine options deliberately and read the resulting state and service columns.',
    },
  ],
  procedureSections: [
    'Start the isolated lab and note the target hostname nmap-target.',
    'Use the browser terminal to run each Nmap command against nmap-target only.',
    'Submit each guided task after reviewing its real output.',
    'Finish the quiz and generate your progress report.',
  ],
  difficulty: 'Beginner',
  estimatedTimeMinutes: 45,
  status: 'published' as const,
  lab: NMAP_LAB_DEFINITION,
  tasks: [
    {
      id: 'live-host',
      title: 'Find the live host',
      description: 'Use host discovery to confirm the private lab target is online.',
      hints: ['Use nmap host discovery options.', 'Target only nmap-target.'],
      marks: 10,
      order: 1,
      verification: [{ type: 'command' as const, tool: 'nmap', requiredArgs: ['-sn'] }],
      completionMessage: 'You verified a live host in the isolated lab.',
    },
    {
      id: 'syn-scan',
      title: 'Perform a SYN scan',
      description: 'Run a TCP SYN scan and identify at least one open target port.',
      hints: ['Use the -sS option.', 'Review open TCP ports in the result.'],
      marks: 15,
      order: 2,
      verification: [{ type: 'command' as const, tool: 'nmap', requiredArgs: ['-sS'] }],
      completionMessage: 'SYN scan command verified.',
    },
    {
      id: 'os-detection',
      title: 'Identify the target OS',
      description: 'Run Nmap OS detection against the lab target.',
      hints: ['Use Nmap OS detection.', 'This may require elevated scanning capability provided in the lab.'],
      marks: 15,
      order: 3,
      verification: [{ type: 'command' as const, tool: 'nmap', requiredArgs: ['-O'] }],
      completionMessage: 'OS detection command verified.',
    },
    {
      id: 'service-detection',
      title: 'Detect running services',
      description: 'Use version detection and find the target HTTP service.',
      hints: ['Use -sV.', 'Look for http in the results.'],
      marks: 20,
      order: 4,
      verification: [{ type: 'command' as const, tool: 'nmap', requiredArgs: ['-sV'] }],
      completionMessage: 'Service detection command verified.',
    },
  ],
  quiz: {
    questions: [
      {
        id: 'q1',
        question: 'Which Nmap option performs a TCP SYN scan?',
        options: ['-sS', '-sn', '-O', '-sV'],
        correctOption: 0,
        explanation: '-sS selects the TCP SYN scan.',
        marks: 5,
      },
      {
        id: 'q2',
        question: 'What does an open port indicate?',
        options: ['A listening service may accept connections', 'The host is powered off', 'The port has no network path', 'Nmap cannot reach the target'],
        correctOption: 0,
        explanation: 'An open state means a service is listening and can accept connections.',
        marks: 5,
      },
      {
        id: 'q3',
        question: 'Why is this lab network private?',
        options: ['To keep scanning controlled and authorized', 'To make Nmap faster on the internet', 'To bypass firewalls', 'To expose Docker to the browser'],
        correctOption: 0,
        explanation: 'The isolated network confines scanning to an authorized disposable target.',
        marks: 5,
      },
    ],
  },
};

/* ── Exp 03: Controlled DoS Attack Simulation & Traffic Analysis (Existing / Preserved) ── */
const dosExperiment = {
  title: 'Controlled DoS Attack Simulation & Traffic Analysis',
  slug: 'controlled-dos-traffic-analysis',
  description: 'Safely simulate bounded denial-of-service traffic in an isolated private laboratory and compare it with normal HTTP traffic.',
  aim: 'Observe controlled SYN traffic, identify repeated requests and packet-rate spikes, and explain why DoS testing must be isolated.',
  objectives: [
    'Understand denial-of-service traffic and its impact.',
    'Establish a baseline of normal HTTP traffic.',
    'Generate a bounded SYN simulation against the assigned victim.',
    'Identify repeated SYN packets and packet-rate changes with tshark concepts.',
    'Compare normal and abnormal traffic safely.',
  ],
  theorySections: [
    {
      title: 'Controlled DoS simulation',
      content: 'A DoS attack tries to degrade availability by overwhelming a service or its network path. This lab generates only 60 SYN probes at 10 packets per second, against the disposable victim on the private Docker network.',
    },
    {
      title: 'Traffic analysis',
      content: 'Use tshark-style packet evidence to compare normal HTTP requests from the legitimate client with repeated SYN packets. Repeated SYNs and incomplete handshakes can indicate a SYN-flood pattern; packet rate provides the context.',
    },
  ],
  procedureSections: [
    'Start the lab; you receive a terminal only on attacker. The victim hostname is victim.',
    'Establish a normal HTTP baseline with curl http://victim.',
    'Run dos-sim. It is a fixed 60-packet, 10-packet-per-second SYN simulation to victim only.',
    'Run tshark -i eth0 -Y "tcp.flags.syn == 1" and compare its SYN evidence with the baseline.',
    'Submit each server-verified task, complete the quiz, and download the existing report.',
  ],
  difficulty: 'Intermediate',
  estimatedTimeMinutes: 40,
  status: 'published' as const,
  lab: DOS_LAB_DEFINITION,
  tasks: [
    {
      id: 'baseline',
      title: 'Establish Normal Traffic',
      description: 'Request the controlled victim and confirm its normal HTTP response.',
      hints: ['Run curl http://victim.', 'Look for the CyberLabX DoS Analysis Target response.'],
      marks: 15,
      order: 1,
      verification: [
        { type: 'command' as const, tool: 'curl', requiredTarget: 'victim' },
        { type: 'output_contains' as const, requiredOutput: ['CyberLabX DoS Analysis Target'] },
      ],
      completionMessage: 'Normal request-to-response traffic was verified.',
    },
    {
      id: 'controlled-syn',
      title: 'Generate Controlled Attack Traffic',
      description: 'Run the approved bounded SYN simulation. It cannot accept a destination, rate, or count.',
      hints: ['Run dos-sim exactly.', 'The command reports its fixed count and rate when complete.'],
      marks: 20,
      order: 2,
      verification: [{ type: 'bounded_network_activity' as const, tool: 'dos-sim' }],
      completionMessage: 'Server-captured evidence verified the bounded SYN simulation to victim only.',
    },
    {
      id: 'capture-syn',
      title: 'Capture and Identify Attack Traffic',
      description: 'Use the lab tshark workflow to identify repeated SYN traffic involving the victim.',
      hints: ['Run tshark -i eth0 -Y "tcp.flags.syn == 1".', 'Look for victim and SYN fields in the summary.'],
      marks: 20,
      order: 3,
      verification: [{ type: 'packet_analysis' as const, tool: 'tshark', requiredOutput: ['victim', 'SYN', '60'] }],
      completionMessage: 'Packet-analysis evidence identified repeated SYN traffic.',
    },
    {
      id: 'analyze-anomaly',
      title: 'Analyze the Traffic Pattern',
      description: 'Run the tshark workflow again and identify the abnormal packet-rate and incomplete-handshake indicators.',
      hints: ['Run tshark -i eth0 -Y "tcp.flags.syn == 1".', 'Compare the SYN burst with normal HTTP requests.'],
      marks: 20,
      order: 4,
      verification: [{ type: 'packet_analysis' as const, tool: 'tshark', requiredOutput: ['packet-rate spike', 'incomplete tcp handshakes', 'victim'] }],
      completionMessage: 'Traffic anomaly analysis was verified from server-captured lab evidence.',
    },
  ],
  quiz: {
    questions: [
      {
        id: 'q1',
        question: 'What is the primary objective of a DoS attack?',
        options: ['Reduce or deny availability of a service', 'Encrypt a victim disk', 'Discover operating systems', 'Improve server capacity'],
        correctOption: 0,
        explanation: 'DoS attacks aim to make a service unavailable or degraded.',
        marks: 5,
      },
      {
        id: 'q2',
        question: 'Which traffic characteristic can indicate a SYN flood?',
        options: ['Many repeated SYN packets without completed handshakes', 'One successful HTTP response', 'A stable packet rate', 'A DNS cache hit'],
        correctOption: 0,
        explanation: 'Repeated SYNs with incomplete handshakes are a common indicator.',
        marks: 5,
      },
      {
        id: 'q3',
        question: 'What is Wireshark/tshark used for in this experiment?',
        options: ['Capturing and analyzing network traffic', 'Publishing host ports', 'Granting Docker access', 'Generating unrestricted traffic'],
        correctOption: 0,
        explanation: 'Wireshark and tshark help inspect packets and patterns.',
        marks: 5,
      },
      {
        id: 'q4',
        question: 'Why is a sudden increase in packet rate significant?',
        options: ['It can reveal abnormal or attack traffic', 'It proves all traffic is encrypted', 'It removes packet loss', 'It identifies a user account'],
        correctOption: 0,
        explanation: 'Packet-rate spikes can distinguish an abnormal burst from baseline traffic.',
        marks: 5,
      },
      {
        id: 'q5',
        question: 'Why must DoS simulations be performed in an isolated environment?',
        options: ['To prevent effects on real systems and networks', 'To bypass ownership checks', 'To reach more internet hosts', 'To avoid traffic capture'],
        correctOption: 0,
        explanation: 'Isolation keeps the simulation authorized, bounded, and harmless.',
        marks: 5,
      },
    ],
  },
};

/* ── Exp 01: Information Gathering Using Tools (Phase 1) ── */
const reconExperiment = {
  title: 'Information Gathering Using Tools',
  slug: 'information-gathering-tools',
  description: 'Perform active and passive reconnaissance against a controlled educational target using standard information-gathering utilities.',
  aim: 'Perform active and passive information gathering and reconnaissance on a controlled laboratory target using standard reconnaissance utilities and OSINT interpretation.',
  objectives: [
    'Test network reachability and host connectivity using ICMP echo probes.',
    'Perform domain name queries and inspect DNS records.',
    'Trace network routing paths to private laboratory targets.',
    'Enumerate listening services and port profiles using Nmap.',
    'Inspect local listening sockets and network connections using netstat.',
    'Analyze passive open-source intelligence (OSINT) and footprinting records.',
  ],
  theorySections: [
    {
      title: 'Reconnaissance & Footprinting',
      content: 'Reconnaissance is the initial phase of security assessment where an investigator gathers intelligence about target systems, domain infrastructure, network paths, and exposed services. Information gathering is divided into passive reconnaissance (observing publicly available data, WHOIS records, DNS entries) and active reconnaissance (direct probes such as ICMP ping, traceroute, and port scans).',
    },
    {
      title: 'DNS Resolution & Port Enumeration',
      content: 'Domain Name System (DNS) translation reveals mapping between human-readable domain names and IP addresses. Service and port scanning identifies open network ports and software versions running on target endpoints, providing a profile of potential attack surfaces while adhering to authorized laboratory boundaries.',
    },
  ],
  procedureSections: [
    'Start the isolated laboratory environment; your Kali terminal connects to the private experiment network with target recon-target.',
    'Test host reachability by running ping -c 4 recon-target.',
    'Perform DNS resolution using nslookup recon-target to determine target address information.',
    'Trace network path with traceroute -n recon-target.',
    'Enumerate open services and listening ports with nmap -sV recon-target.',
    'Inspect local network sockets and listening services using netstat -tlpn.',
    'Analyze controlled passive OSINT intelligence using recon-osint recon-target.',
    'Submit each task after inspecting real output, finish the knowledge quiz, and download your laboratory report.',
  ],
  difficulty: 'Beginner',
  estimatedTimeMinutes: 45,
  status: 'published' as const,
  lab: RECON_LAB_DEFINITION,
  tasks: [
    {
      id: 'recon-connectivity',
      title: 'Host Reachability & Discovery',
      description: 'Use the ping utility to confirm network connectivity and verify round-trip response from recon-target.',
      hints: ['Run ping -c 4 recon-target.', 'Target only the assigned host recon-target.'],
      marks: 10,
      order: 1,
      verification: [
        { type: 'command' as const, tool: 'ping', requiredTarget: 'recon-target' },
        { type: 'output_contains' as const, requiredOutput: ['packets transmitted', ', 0% packet loss'] },
      ],
      completionMessage: 'Target reachability confirmed with zero packet loss.',
    },
    {
      id: 'recon-dns',
      title: 'DNS Query & Name Resolution',
      description: 'Query DNS name resolution for recon-target using nslookup to verify address resolution.',
      hints: ['Run nslookup recon-target.', 'Inspect the returned IP address.'],
      marks: 10,
      order: 2,
      verification: [
        { type: 'command' as const, tool: 'nslookup', requiredTarget: 'recon-target' },
        { type: 'output_contains' as const, requiredOutput: ['recon-target', 'Address'] },
      ],
      completionMessage: 'DNS query successfully resolved target hostname.',
    },
    {
      id: 'recon-route',
      title: 'Network Route Discovery',
      description: 'Trace the network routing path to the assigned target using traceroute.',
      hints: ['Run traceroute -n recon-target or traceroute recon-target.'],
      marks: 10,
      order: 3,
      verification: [
        { type: 'command' as const, tool: 'traceroute', requiredTarget: 'recon-target' },
        { type: 'output_contains' as const, requiredOutput: ['traceroute to recon-target'] },
      ],
      completionMessage: 'Network hop route to lab target confirmed.',
    },
    {
      id: 'recon-service',
      title: 'Network & Service Enumeration',
      description: 'Run Nmap version detection against recon-target to discover open services.',
      hints: ['Run nmap -sV recon-target.', 'Observe listening HTTP and DNS ports.'],
      marks: 15,
      order: 4,
      verification: [
        { type: 'command' as const, tool: 'nmap', requiredArgs: ['-sV'], requiredTarget: 'recon-target' },
        { type: 'output_contains' as const, requiredOutput: ['80/tcp', 'open', 'http'] },
      ],
      completionMessage: 'Target HTTP service and port configuration detected.',
    },
    {
      id: 'recon-local-sockets',
      title: 'Local Socket & Connection Inspection',
      description: 'Inspect active local listening sockets and network connections using netstat or ss.',
      hints: ['Run netstat -tlpn or ss -tulpn.', 'Examine local listening addresses.'],
      marks: 10,
      order: 5,
      verification: [
        { type: 'command' as const, tool: 'netstat', requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['Active Internet connections'] },
      ],
      completionMessage: 'Local socket and listening port table inspected.',
    },
    {
      id: 'recon-osint',
      title: 'OSINT & Public Footprint Analysis',
      description: 'Execute the controlled recon-osint utility against recon-target to evaluate passive footprint findings.',
      hints: ['Run recon-osint recon-target.', 'Review simulated WHOIS and subdomain records.'],
      marks: 15,
      order: 6,
      verification: [
        { type: 'command' as const, tool: 'recon-osint', requiredTarget: 'recon-target' },
        { type: 'output_contains' as const, requiredOutput: ['OSINT Analysis Complete', 'subdomains'] },
      ],
      completionMessage: 'Controlled OSINT footprint dataset analyzed.',
    },
  ],
  quiz: {
    questions: [
      {
        id: 'rq1',
        question: 'What is the principal difference between active and passive reconnaissance?',
        options: [
          'Active reconnaissance directly sends packets to the target; passive observes publicly available data without direct target interaction',
          'Active reconnaissance uses encryption; passive reconnaissance uses plain text',
          'Passive reconnaissance requires root privileges; active reconnaissance does not',
          'There is no difference in methodology between the two',
        ],
        correctOption: 0,
        explanation: 'Active reconnaissance engages with target systems directly, whereas passive reconnaissance relies on publicly available information.',
        marks: 5,
      },
      {
        id: 'rq2',
        question: 'Which DNS record type specifies the mail server responsible for receiving messages on behalf of a domain?',
        options: ['MX record', 'A record', 'PTR record', 'CNAME record'],
        correctOption: 0,
        explanation: 'MX (Mail Exchanger) records route emails to the designated mail servers for a domain.',
        marks: 5,
      },
      {
        id: 'rq3',
        question: 'What information does a WHOIS query typically provide?',
        options: [
          'Domain registration data, registrar, creation/expiry dates, and registrant organization',
          'Current CPU load on the server',
          'Encrypted SSL private keys',
          'Real-time network traffic volume',
        ],
        correctOption: 0,
        explanation: 'WHOIS databases store administrative and registration data for internet domains and IP allocations.',
        marks: 5,
      },
      {
        id: 'rq4',
        question: 'Why should reconnaissance against unauthorized public internet systems be prohibited?',
        options: [
          'Scanning unauthorized systems may violate computer misuse laws and organizational policies',
          'It is technically impossible without hardware upgrades',
          'Nmap only functions on private Docker networks',
          'Public IP addresses do not have ports',
        ],
        correctOption: 0,
        explanation: 'Conducting port scanning and network probing without explicit written authorization is unlawful.',
        marks: 5,
      },
      {
        id: 'rq5',
        question: 'Which utility is used to display network connections, routing tables, and interface statistics on Linux?',
        options: ['netstat / ss', 'chmod', 'ping', 'tar'],
        correctOption: 0,
        explanation: 'netstat and ss are standard network diagnostic utilities for inspecting active sockets and network state.',
        marks: 5,
      },
    ],
  },
};

/* ── Exp 04: Keylogger Using skeylogger (Phase 2) ── */
const keyloggerExperiment = {
  title: 'Keylogger Implementation & Threat Analysis using skeylogger',
  slug: 'keylogger-skeylogger-threat-analysis',
  description: 'Implement and compile an educational keylogger using skeylogger in Kali Linux, observe captured input in a strictly isolated sandbox, and study defensive countermeasures.',
  aim: 'To implement an educational software keylogger using skeylogger in Kali Linux, observe controlled keystroke capture in an isolated disposable sandbox, analyze security risks, and evaluate defensive countermeasures.',
  objectives: [
    'Understand the working principles of keystroke loggers in Linux operating systems.',
    'Compile and configure the educational skeylogger utility using GCC.',
    'Execute keystroke interception strictly within an isolated disposable container.',
    'Simulate user input using controlled test strings and verify captured log data.',
    'Analyze risks of confidential credential leakage from unauthorized keyloggers.',
    'Evaluate defensive methods including endpoint protection and least privilege.',
  ],
  theorySections: [
    {
      title: 'Working Principle of Keystroke Loggers',
      content: 'A keylogger is a software or hardware utility designed to record keystrokes entered by a user. While used legitimately for usability testing and debugging, keyloggers are commonly deployed by adversaries to steal confidential credentials, passwords, and sensitive communications. In Linux, software keyloggers capture input by reading input device events or hooking into input streams.',
    },
    {
      title: 'Defensive Countermeasures & Sandboxing',
      content: 'Mitigating keylogger threats requires defense-in-depth: endpoint detection and response (EDR), application allowlisting, integrity monitoring, multi-factor authentication (which diminishes the utility of stolen static passwords), virtual keyboards, and enforcing strict least privilege so untrusted binaries cannot access input devices or background services.',
    },
  ],
  procedureSections: [
    'Start the isolated keylogger laboratory; your disposable workspace opens in /root/skeylogger.',
    'Compile the skeylogger source code using make (or gcc -Wall -O2 -o skeylogger skeylogger.c).',
    'Launch skeylogger in the background: ./skeylogger &.',
    'Inject controlled test keystrokes using lab-test-input "SomaiyaLabTest2026".',
    'Inspect the captured log file with cat skeylogger.log.',
    'Verify how sensitive keystrokes were captured and explain defensive countermeasures.',
    'Complete the quiz and download your practical report.',
  ],
  difficulty: 'Intermediate',
  estimatedTimeMinutes: 40,
  status: 'published' as const,
  lab: KEYLOGGER_LAB_DEFINITION,
  tasks: [
    {
      id: 'compile-skeylogger',
      title: 'Compile skeylogger with GCC',
      description: 'Compile the skeylogger source code using make or gcc to generate the executable binary.',
      hints: ['Run make or gcc -Wall -O2 -o skeylogger skeylogger.c.'],
      marks: 15,
      order: 1,
      verification: [
        { type: 'command' as const, tool: 'make', requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['skeylogger'] },
      ],
      completionMessage: 'skeylogger compiled successfully with GCC.',
    },
    {
      id: 'launch-skeylogger',
      title: 'Launch Controlled Keylogger',
      description: 'Run the compiled skeylogger executable in the background to initialize the virtual input listener.',
      hints: ['Run ./skeylogger & or ./skeylogger in the background.'],
      marks: 15,
      order: 2,
      verification: [
        { type: 'command' as const, tool: './skeylogger', requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['skeylogger listening', 'Log destination'] },
      ],
      completionMessage: 'skeylogger active and listening on virtual input pipe.',
    },
    {
      id: 'inject-test-input',
      title: 'Simulate Harmless User Input',
      description: 'Use the lab test utility to transmit the authorized test string SomaiyaLabTest2026.',
      hints: ['Run lab-test-input "SomaiyaLabTest2026".'],
      marks: 15,
      order: 3,
      verification: [
        { type: 'command' as const, tool: 'lab-test-input', requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['Transmitted', 'keystrokes into lab input buffer'] },
      ],
      completionMessage: 'Controlled input successfully fed to the laboratory input stream.',
    },
    {
      id: 'inspect-log',
      title: 'Inspect Captured Keystroke Log',
      description: 'Examine skeylogger.log to verify the captured keystroke buffer and timestamped entries.',
      hints: ['Run cat skeylogger.log.'],
      marks: 15,
      order: 4,
      verification: [
        { type: 'command' as const, tool: 'cat', requiredArgs: ['skeylogger.log'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['CAPTURED BUFFER', 'SomaiyaLabTest2026'] },
      ],
      completionMessage: 'Keystroke capture verified from authoritative log output.',
    },
  ],
  quiz: {
    questions: [
      {
        id: 'kq1',
        question: 'What is the primary security risk posed by unauthorized keystroke loggers?',
        options: [
          'Exfiltration of confidential credentials, passwords, and sensitive user communications',
          'Physical degradation of the hardware keyboard switches',
          'Accelerated consumption of network bandwidth only',
          'Automatic reformatting of the host storage partition',
        ],
        correctOption: 0,
        explanation: 'Keyloggers record all typed input, directly exposing credentials, secrets, and private messages.',
        marks: 5,
      },
      {
        id: 'kq2',
        question: 'Why must keylogger experiments strictly prohibit host /dev/input device access?',
        options: [
          'To prevent intercepting actual passwords or typing belonging to the host user or other system sessions',
          'Because Linux cannot compile C programs with /dev/input',
          'Because Docker requires root privilege for keyboard typing',
          'To improve GCC compiler performance',
        ],
        correctOption: 0,
        explanation: 'Accessing host /dev/input would capture real-world keystrokes from the host machine, violating isolation and privacy.',
        marks: 5,
      },
      {
        id: 'kq3',
        question: 'Which defensive security control significantly reduces the damage of stolen static passwords?',
        options: [
          'Multi-Factor Authentication (MFA / 2FA)',
          'Increasing screen brightness',
          'Renaming executable file extensions',
          'Disabling terminal command history',
        ],
        correctOption: 0,
        explanation: 'MFA requires time-based or biometric secondary factors, preventing attackers from authenticating with static passwords alone.',
        marks: 5,
      },
      {
        id: 'kq4',
        question: 'How do endpoint detection and response (EDR) systems detect software keyloggers?',
        options: [
          'By monitoring API hooks, abnormal input device polling, and unauthorized background process behavior',
          'By measuring keyboard physical temperature',
          'By disabling the operating system kernel',
          'By deleting all C source code files',
        ],
        correctOption: 0,
        explanation: 'EDR monitors system API calls, hook registrations, and anomalous access to OS input event streams.',
        marks: 5,
      },
      {
        id: 'kq5',
        question: 'What does the principle of least privilege dictate regarding application permissions?',
        options: [
          'Applications should only run with the minimum privileges and device access necessary to perform their legitimate function',
          'All desktop applications should run as root',
          'Users must grant unrestricted permissions to all downloaded utilities',
          'Input devices should be globally world-writable',
        ],
        correctOption: 0,
        explanation: 'Least privilege minimizes risk by restricting programs from accessing sensitive resources like input hardware without authorization.',
        marks: 5,
      },
    ],
  },
};

/* ── Exp 05: Email Forensics using Kali Linux (Phase 3) ── */
const emailForensicsExperiment = {
  title: 'Email Forensics & Header Analysis using Kali Linux',
  slug: 'email-forensics-kali-linux',
  description: 'Investigate synthetic email evidence in Kali Linux: analyze routing headers, verify SPF/DKIM/DMARC status, extract MIME attachments, compute cryptographic hashes, and inspect metadata.',
  aim: 'To implement Email Forensics in Cyber Security using Kali Linux by collecting a raw email, examining its headers and routing information, extracting embedded artifacts and MIME parts, calculating file hashes, and analyzing metadata.',
  objectives: [
    'Obtain and preserve raw email evidence in standard RFC 822 / MIME format.',
    'Reconstruct mail delivery routing chains by analyzing Received headers.',
    'Examine email authentication mechanisms including SPF, DKIM, and DMARC.',
    'Extract embedded MIME attachments safely using ripmime.',
    'Calculate cryptographic SHA-256 hashes to maintain evidence integrity.',
    'Inspect document metadata using ExifTool without executing suspicious attachments.',
  ],
  theorySections: [
    {
      title: 'Email Header Anatomy & Delivery Routing',
      content: 'An email message consists of an envelope, headers, and body. As an email travels across the internet, each Mail Transfer Agent (MTA) prepends a Received header recording the sender IP, receiver IP, timestamps, and transport protocol. Reading Received headers from bottom to top reconstructs the true path of the message.',
    },
    {
      title: 'Email Authentication & Forensic Soundness',
      content: 'SPF (Sender Policy Framework), DKIM (DomainKeys Identified Mail), and DMARC (Domain-based Message Authentication, Reporting, and Conformance) provide sender verification to combat spoofing. Forensic best practices demand that evidence is preserved in its raw .eml format and hashed immediately before analysis on copies.',
    },
  ],
  procedureSections: [
    'Open terminal in ~/EmailForensics; observe pre-seeded evidence in evidence/email_sample.eml.',
    'Calculate and record the original SHA-256 hash using sha256sum evidence/email_sample.eml.',
    'Inspect email headers and authentication results using grep -iE "^(Received|From|To|Subject|Authentication-Results):" evidence/email_sample.eml.',
    'Extract MIME attachments safely using ripmime -i evidence/email_sample.eml -d attachments.',
    'Inspect the extracted file type using file attachments/* and verify its SHA-256 hash.',
    'Extract artifact metadata using exiftool attachments/* without opening or executing the file.',
    'Submit verified tasks, complete the quiz, and download the forensic laboratory report.',
  ],
  difficulty: 'Intermediate',
  estimatedTimeMinutes: 45,
  status: 'published' as const,
  lab: EMAIL_FORENSICS_LAB_DEFINITION,
  tasks: [
    {
      id: 'hash-original-email',
      title: 'Preserve & Hash Original Evidence',
      description: 'Compute the SHA-256 cryptographic hash of evidence/email_sample.eml to establish chain of custody.',
      hints: ['Run sha256sum evidence/email_sample.eml.'],
      marks: 10,
      order: 1,
      verification: [
        { type: 'command' as const, tool: 'sha256sum', requiredArgs: ['evidence/email_sample.eml'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['7e908d2f30e259d72bc0737c2ad1afae4f7199246c632713814f369884f051ca'] },
      ],
      completionMessage: 'Original email evidence hashed and preserved.',
    },
    {
      id: 'header-analysis',
      title: 'Examine Email Routing & Authentication',
      description: 'Inspect email headers to examine the Received transmission hops and SPF/DKIM/DMARC authentication status.',
      hints: ['Run grep -iE "^(Received|From|To|Subject|Authentication-Results):" evidence/email_sample.eml.'],
      marks: 15,
      order: 2,
      verification: [
        { type: 'command' as const, tool: 'grep', requiredArgs: ['evidence/email_sample.eml'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['Authentication-Results', 'dkim=fail', 'spf=softfail'] },
      ],
      completionMessage: 'Email routing and spoofing authentication failure identified.',
    },
    {
      id: 'extract-mime',
      title: 'Extract MIME Attachments with ripmime',
      description: 'Use ripmime to extract all embedded attachments and MIME streams from the raw email into attachments/.',
      hints: ['Run ripmime -i evidence/email_sample.eml -d attachments.'],
      marks: 15,
      order: 3,
      verification: [
        { type: 'command' as const, tool: 'ripmime', requiredArgs: ['-i', 'evidence/email_sample.eml', '-d', 'attachments'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: [''] },
      ],
      completionMessage: 'MIME parts extracted safely into isolated directory.',
    },
    {
      id: 'identify-attachment',
      title: 'Identify Extracted Artifact Type',
      description: 'Use the file command to verify the actual file format of extracted attachments.',
      hints: ['Run file attachments/*.'],
      marks: 10,
      order: 4,
      verification: [
        { type: 'command' as const, tool: 'file', requiredArgs: ['attachments/accountnotice.pdf'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['PDF document'] },
      ],
      completionMessage: 'Extracted attachment verified as PDF document.',
    },
    {
      id: 'metadata-inspection',
      title: 'Inspect Metadata with ExifTool',
      description: 'Run ExifTool against extracted attachments to analyze document metadata without executing untrusted files.',
      hints: ['Run exiftool attachments/*.'],
      marks: 10,
      order: 5,
      verification: [
        { type: 'command' as const, tool: 'exiftool', requiredArgs: ['attachments/accountnotice.pdf'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['PDF Version', 'MIME Type'] },
      ],
      completionMessage: 'Document metadata safely extracted and analyzed.',
    },
  ],
  quiz: {
    questions: [
      {
        id: 'eq1',
        question: 'In what chronological sequence should Received email headers be read to trace an email from its origin?',
        options: [
          'From bottom to top (bottom-most Received header is closest to origin MTA)',
          'From top to bottom',
          'Alphabetically by domain name',
          'Received headers contain no transmission sequence information',
        ],
        correctOption: 0,
        explanation: 'Each mail relay prepends its Received header at the top, meaning the earliest originating hop is at the bottom.',
        marks: 5,
      },
      {
        id: 'eq2',
        question: 'What is the purpose of the SPF (Sender Policy Framework) mechanism?',
        options: [
          'To verify whether the sending MTA IP is authorized by the sending domain DNS records',
          'To encrypt the email body with asymmetric keys',
          'To compress large email attachments',
          'To automatically forward emails to backup servers',
        ],
        correctOption: 0,
        explanation: 'SPF allows domain owners to publish IP addresses authorized to send emails on behalf of their domain.',
        marks: 5,
      },
      {
        id: 'eq3',
        question: 'What digital forensic requirement mandates computing SHA-256 hashes of an email before starting analysis?',
        options: [
          'Chain of custody and evidence integrity preservation',
          'Increasing disk read speed',
          'Translating MIME base64 into plain text',
          'Preventing spam filters from rejecting the file',
        ],
        correctOption: 0,
        explanation: 'Hashing proves that digital evidence has not been tampered with or modified during the investigation.',
        marks: 5,
      },
      {
        id: 'eq4',
        question: 'Why should forensic investigators NEVER double-click or execute attachments extracted from suspicious emails?',
        options: [
          'Executing untrusted attachments could execute malicious payloads, compromising the analysis workstation',
          'Because PDF files cannot be opened in Linux',
          'Because file hashes become permanent and cannot be deleted',
          'Operating systems do not permit opening email attachments',
        ],
        correctOption: 0,
        explanation: 'Untrusted attachments may contain malware, exploits, or macros; safe inspection requires static tools like ExifTool and file.',
        marks: 5,
      },
      {
        id: 'eq5',
        question: 'What information does ExifTool extract from digital documents and images?',
        options: [
          'Embedded metadata such as author, creation timestamps, software tools, and file structure',
          'Live internet connection speeds',
          'User banking credentials',
          'DNS root zone records',
        ],
        correctOption: 0,
        explanation: 'ExifTool reads file metadata tags (EXIF, IPTC, XMP) without executing the target file.',
        marks: 5,
      },
    ],
  },
};

/* ── Exp 06: Identification of File Type Using Hex Editor and Extension Obfuscation (Phase 4) ── */
const fileForensicsExperiment = {
  title: 'Identification of File Type Using Hex Editor and Extension Obfuscation',
  slug: 'file-type-hex-editor-extension-obfuscation',
  description: 'Analyze disguised files using hex tools: detect magic numbers, identify file extension spoofing, safely rename working copies, and verify forensic integrity.',
  aim: 'To identify the actual file type of a disguised file using a Hex Editor and magic number signatures, understand extension obfuscation, rename a copy to the correct extension, and verify evidence integrity.',
  objectives: [
    'Understand that operating systems may be misled by false file extensions.',
    'Inspect raw file headers and hex signatures (magic numbers) using hex tools.',
    'Identify the JPEG file signature (FF D8 FF E0) in a disguised system file.',
    'Use the file utility to verify authoritative file identification.',
    'Perform non-destructive evidence recovery by working only on copies.',
    'Verify recovered file integrity using SHA-256 hashing.',
  ],
  theorySections: [
    {
      title: 'File Signatures & Magic Numbers',
      content: 'A file extension is merely part of a filename and can easily be altered to disguise malicious payloads or conceal sensitive evidence. Operating systems and forensic tools inspect the initial bytes of a file (known as magic numbers or file signatures) to determine true file type. For example, JPEG files consistently begin with the hexadecimal bytes FF D8 FF.',
    },
    {
      title: 'Forensic Integrity & Evidence Handling',
      content: 'In digital forensics, original evidence must never be modified or overwritten. Analysts create working copies in separate directories, perform analysis on the working copy, and verify that the cryptographic hash of the recovered file matches the original evidence.',
    },
  ],
  procedureSections: [
    'Open terminal in ~/file_forensics; original evidence is stored in original/disguised_image.sys.',
    'Examine the metadata of working/disguised_image.sys using file.',
    'Inspect the first bytes of the file in hexadecimal using xxd working/disguised_image.sys | head -n 5.',
    'Identify the JPEG signature FF D8 FF in the hex dump.',
    'Verify the true file type using the Linux file utility.',
    'Recover the file by creating a copy with the correct extension: cp working/disguised_image.sys recovered/recovered.jpg.',
    'Verify the recovered file with file recovered/recovered.jpg and verify matching SHA-256 hashes.',
  ],
  difficulty: 'Beginner',
  estimatedTimeMinutes: 35,
  status: 'published' as const,
  lab: FILE_FORENSICS_LAB_DEFINITION,
  tasks: [
    {
      id: 'inspect-initial',
      title: 'Initial File Inspection',
      description: 'Inspect working/disguised_image.sys using the file command to observe its detected type despite the .sys extension.',
      hints: ['Run file working/disguised_image.sys.'],
      marks: 10,
      order: 1,
      verification: [
        { type: 'command' as const, tool: 'file', requiredArgs: ['working/disguised_image.sys'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['JPEG image data'] },
      ],
      completionMessage: 'File utility revealed underlying JPEG image format.',
    },
    {
      id: 'hex-signature',
      title: 'Inspect Hex Header & Magic Number',
      description: 'Run xxd or hexdump on working/disguised_image.sys to inspect the magic bytes at offset 0.',
      hints: ['Run xxd working/disguised_image.sys | head -n 5.'],
      marks: 15,
      order: 2,
      verification: [
        { type: 'command' as const, tool: 'xxd', requiredArgs: ['working/disguised_image.sys'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['ffd8', 'ffe0'] },
      ],
      completionMessage: 'Magic number FF D8 FF E0 confirmed as JPEG signature.',
    },
    {
      id: 'rename-recovery',
      title: 'Safe Extension Correction & Recovery',
      description: 'Copy working/disguised_image.sys to recovered/recovered.jpg without modifying the original evidence.',
      hints: ['Run cp working/disguised_image.sys recovered/recovered.jpg.'],
      marks: 15,
      order: 3,
      verification: [
        { type: 'command' as const, tool: 'cp', requiredArgs: ['working/disguised_image.sys', 'recovered/recovered.jpg'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: [''] },
      ],
      completionMessage: 'Working copy recovered with legitimate .jpg extension.',
    },
    {
      id: 'verify-integrity',
      title: 'Integrity Verification with SHA-256',
      description: 'Compare the SHA-256 hashes of original/disguised_image.sys and recovered/recovered.jpg to prove identical data.',
      hints: ['Run sha256sum original/disguised_image.sys recovered/recovered.jpg.'],
      marks: 20,
      order: 4,
      verification: [
        { type: 'command' as const, tool: 'sha256sum', requiredArgs: ['original/disguised_image.sys', 'recovered/recovered.jpg'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['original/disguised_image.sys', 'recovered/recovered.jpg'] },
      ],
      completionMessage: 'Forensic integrity verified: original and recovered hashes match.',
    },
  ],
  quiz: {
    questions: [
      {
        id: 'fq1',
        question: 'What is a "magic number" (file signature) in digital forensics?',
        options: [
          'A specific sequence of bytes located at the beginning of a file that identifies its actual format',
          'A random mathematical encryption key',
          'The total file size rounded to the nearest kilobyte',
          'The number of times a file has been opened',
        ],
        correctOption: 0,
        explanation: 'Magic numbers are fixed byte sequences at the file header that unambiguously define the file format.',
        marks: 5,
      },
      {
        id: 'fq2',
        question: 'What hexadecimal magic bytes identify a standard JPEG image file?',
        options: ['FF D8 FF', '89 50 4E 47', '25 50 44 46', '4D 5A 90 00'],
        correctOption: 0,
        explanation: 'JPEG images begin with the Start of Image (SOI) marker: FF D8 FF (often followed by E0 or E1 for JFIF/Exif).',
        marks: 5,
      },
      {
        id: 'fq3',
        question: 'Why do attackers disguise file extensions (e.g. naming an executable malware.txt)?',
        options: [
          'To trick users into opening malicious files and bypass basic file-extension filtering',
          'To make the file download faster',
          'To automatically encrypt the operating system',
          'Because operating systems refuse to run files with proper extensions',
        ],
        correctOption: 0,
        explanation: 'Obfuscating file extensions is a common technique to deceive users and evade simplistic security rules.',
        marks: 5,
      },
      {
        id: 'fq4',
        question: 'Why must digital forensic analysts work on copies rather than the original evidence file?',
        options: [
          'To preserve the original evidence in pristine condition and prevent accidental alteration or spoliation',
          'Because copying increases the file quality',
          'Because Linux cannot open original files directly',
          'To allow other users to delete the original',
        ],
        correctOption: 0,
        explanation: 'Forensic standards mandate preserving master evidence unaltered, conducting all analysis on verified duplicate copies.',
        marks: 5,
      },
      {
        id: 'fq5',
        question: 'How does the Linux "file" command determine a file type?',
        options: [
          'By inspecting magic numbers and internal file headers via libmagic, rather than relying on filename extensions',
          'By checking the filename spelling in a dictionary',
          'By querying internet DNS servers',
          'By running the file as a program',
        ],
        correctOption: 0,
        explanation: 'The file command uses the libmagic database to test file headers against known signature patterns.',
        marks: 5,
      },
    ],
  },
};

/* ── Exp 07: Disk Imaging, Disk Cloning & File Recovery (Phase 5) ── */
const diskForensicsExperiment = {
  title: 'Disk Imaging, Disk Cloning & Forensic File Recovery',
  slug: 'disk-imaging-cloning-file-recovery',
  description: 'Acquire raw bit-stream disk images with dd, verify cryptographic SHA-256 integrity, clone disk images, and recover evidence files safely.',
  aim: 'To simulate disk imaging and disk cloning in Kali Linux and demonstrate how a disk image can be used for file recovery without modifying the original source data.',
  objectives: [
    'Understand the concepts of bit-stream disk imaging and disk cloning.',
    'Safely operate on disposable virtual disk images without accessing physical host disks.',
    'Acquire a forensic raw image using the dd acquisition utility.',
    'Generate and verify cryptographic SHA-256 checksums to prove image integrity.',
    'Clone the forensic disk image and verify clone fidelity.',
    'Perform file recovery on an image copy and verify recovered files against original evidence.',
  ],
  theorySections: [
    {
      title: 'Forensic Bit-Stream Imaging vs. Logical Copying',
      content: 'A standard file copy duplicates active files while ignoring unallocated space, file slack, and metadata structures. In contrast, forensic disk imaging creates a bit-stream replica (raw bit-for-bit duplicate) of the entire drive geometry. Imaging preserves deleted file fragments, timestamp metadata, and directory indexes necessary for forensic analysis.',
    },
    {
      title: 'Integrity Verification & Safe Analysis Protocol',
      content: 'To preserve forensic soundness, investigators compute a cryptographic hash (such as SHA-256) immediately after imaging and verify that the hash never changes. Active recovery is performed on duplicate clone images (recovery_test.img) so the master image remains pristine.',
    },
  ],
  procedureSections: [
    'Open terminal in ~/disk_forensics; source disk is provided as source_disk.img with evidence in evidence/.',
    'Acquire a raw forensic image: dd if=source_disk.img of=disk_image.img bs=64K status=progress.',
    'Generate the image hash: sha256sum disk_image.img > disk_image.sha256.',
    'Verify hash integrity: sha256sum -c disk_image.sha256.',
    'Clone the forensic disk image: dd if=disk_image.img of=cloned_disk.img bs=64K.',
    'Compare hashes of disk_image.img and cloned_disk.img to confirm exact clone fidelity.',
    'Create working recovery image: cp disk_image.img recovery_test.img.',
    'Recover evidence files: forensic-recover recovery_test.img recovered_files/.',
    'Verify recovered file integrity: sha256sum evidence/confidential.txt recovered_files/confidential.txt.',
  ],
  difficulty: 'Intermediate',
  estimatedTimeMinutes: 50,
  status: 'published' as const,
  lab: DISK_FORENSICS_LAB_DEFINITION,
  tasks: [
    {
      id: 'acquire-image',
      title: 'Forensic Disk Image Acquisition',
      description: 'Use dd to acquire a bit-stream raw image from source_disk.img to disk_image.img.',
      hints: ['Run dd if=source_disk.img of=disk_image.img bs=64K status=progress.'],
      marks: 10,
      order: 1,
      verification: [
        { type: 'command' as const, tool: 'dd', requiredArgs: ['if=source_disk.img', 'of=disk_image.img'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['records in', 'records out'] },
      ],
      completionMessage: 'Bit-stream forensic acquisition completed.',
    },
    {
      id: 'hash-image',
      title: 'Image Integrity Verification',
      description: 'Generate and verify the SHA-256 checksum of disk_image.img using sha256sum -c.',
      hints: ['Run sha256sum -c disk_image.sha256.'],
      marks: 10,
      order: 2,
      verification: [
        { type: 'command' as const, tool: 'sha256sum', requiredArgs: ['-c', 'disk_image.sha256'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['disk_image.img: OK'] },
      ],
      completionMessage: 'Disk image integrity verified with SHA-256 checksum.',
    },
    {
      id: 'clone-disk',
      title: 'Disk Image Cloning',
      description: 'Create a bit-stream clone of disk_image.img to cloned_disk.img using dd.',
      hints: ['Run dd if=disk_image.img of=cloned_disk.img bs=64K.'],
      marks: 10,
      order: 3,
      verification: [
        { type: 'command' as const, tool: 'dd', requiredArgs: ['if=disk_image.img', 'of=cloned_disk.img'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['records in', 'records out'] },
      ],
      completionMessage: 'Forensic clone created successfully.',
    },
    {
      id: 'verify-clone',
      title: 'Clone Fidelity Comparison',
      description: 'Compare the SHA-256 hashes of disk_image.img and cloned_disk.img to confirm exact bit equality.',
      hints: ['Run sha256sum disk_image.img cloned_disk.img.'],
      marks: 10,
      order: 4,
      verification: [
        { type: 'command' as const, tool: 'sha256sum', requiredArgs: ['disk_image.img', 'cloned_disk.img'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['disk_image.img', 'cloned_disk.img'] },
      ],
      completionMessage: 'Clone integrity verified: forensic master and clone match.',
    },
    {
      id: 'recover-files',
      title: 'Forensic File Recovery',
      description: 'Recover evidence files from recovery_test.img into recovered_files/ using forensic-recover.',
      hints: ['Run cp disk_image.img recovery_test.img and then forensic-recover recovery_test.img recovered_files/.'],
      marks: 10,
      order: 5,
      verification: [
        { type: 'command' as const, tool: 'forensic-recover', requiredArgs: ['recovery_test.img', 'recovered_files/'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['File Recovery: SUCCESSFUL', 'confidential.txt'] },
      ],
      completionMessage: 'Forensic recovery extracted evidence files without mounting host disks.',
    },
    {
      id: 'verify-recovered-hash',
      title: 'Recovered File Hash Verification',
      description: 'Compare the SHA-256 hash of original evidence/confidential.txt and recovered_files/confidential.txt.',
      hints: ['Run sha256sum evidence/confidential.txt recovered_files/confidential.txt.'],
      marks: 10,
      order: 6,
      verification: [
        { type: 'command' as const, tool: 'sha256sum', requiredArgs: ['evidence/confidential.txt', 'recovered_files/confidential.txt'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['evidence/confidential.txt', 'recovered_files/confidential.txt'] },
      ],
      completionMessage: 'Recovered file verified bit-for-bit identical to original evidence.',
    },
  ],
  quiz: {
    questions: [
      {
        id: 'dq1',
        question: 'Why is a bit-stream disk image preferred over a standard logical file copy in digital forensics?',
        options: [
          'A bit-stream image captures unallocated clusters, deleted file fragments, and metadata, whereas a file copy only copies visible active files',
          'A bit-stream image requires less storage space than a file copy',
          'Logical file copies automatically encrypt all data',
          'Bit-stream images can only be analyzed on Windows systems',
        ],
        correctOption: 0,
        explanation: 'Bit-stream images copy every physical sector, preserving deleted files and unallocated slack space essential for investigations.',
        marks: 5,
      },
      {
        id: 'dq2',
        question: 'Why must digital forensic investigations NEVER be performed directly on physical drives (/dev/sda or /dev/nvme0n1)?',
        options: [
          'Operating on physical host drives can alter timestamps, overwrite evidence, or cause catastrophic data loss on the host',
          'Physical drives cannot be read by Linux commands',
          'Because physical drives do not have partitions',
          'To increase the speed of the dd command',
        ],
        correctOption: 0,
        explanation: 'Working directly on physical media risks altering evidentiary data or causing accidental destruction of host storage.',
        marks: 5,
      },
      {
        id: 'dq3',
        question: 'What is the role of a cryptographic checksum (e.g. SHA-256) in disk forensics?',
        options: [
          'To verify and mathematically prove that the disk image has not changed since acquisition',
          'To decrypt hidden passwords on the disk',
          'To speed up file carver recovery',
          'To compress the disk image into a zip archive',
        ],
        correctOption: 0,
        explanation: 'Cryptographic hashes provide mathematical certainty that an image is bit-for-bit identical to when it was acquired.',
        marks: 5,
      },
      {
        id: 'dq4',
        question: 'What does "file carving" (as performed by PhotoRec) refer to?',
        options: [
          'Recovering files based on file headers, footers, and internal structure without relying on filesystem metadata',
          'Physically carving magnetic platters with tools',
          'Deleting files permanently from unallocated space',
          'Formatting a partition with a new filesystem',
        ],
        correctOption: 0,
        explanation: 'File carving reconstructs files directly from raw data sectors using file signatures when filesystem directory entries are lost or deleted.',
        marks: 5,
      },
      {
        id: 'dq5',
        question: 'Why do investigators perform recovery analysis on a clone image rather than the master forensic image?',
        options: [
          'To ensure the master image remains pristine and unmodified as the golden evidence source',
          'Because clone images have higher resolution',
          'Because master images cannot be read twice',
          'To bypass operating system password prompts',
        ],
        correctOption: 0,
        explanation: 'Working on a clone ensures that if analysis tools write temp data or corrupt the filesystem, the master image remains untouched.',
        marks: 5,
      },
    ],
  },
};

/* ── Exp 08: Missing Source Material Entry (Preserved as Draft / Source Required) ── */
const exp08Draft = {
  title: 'Experiment 08 — Advanced Practical Module (Source Material Required)',
  slug: 'experiment-08-pending-source',
  description: 'Academic curriculum definition pending authoritative university syllabus materials. The provided PDF bundle (DEVESH SHUKLA - Exp No 7 & 8.pdf) contains Experiment 07 only.',
  aim: 'Pending source curriculum documentation from Somaiya Vidyavihar University faculty.',
  objectives: [
    'Pending official syllabus documentation for Experiment 08.',
    'Do not fabricate academic content without instructor source materials.',
  ],
  theorySections: [
    {
      title: 'Curriculum Specification Notice',
      content: 'This experiment placeholder is documented in accordance with institutional policy. Experiment 08 source documentation was not included in the supplied course files and has not been fabricated.',
    },
  ],
  procedureSections: [
    'Awaiting academic syllabus upload by Somaiya department instructors.',
  ],
  difficulty: 'Advanced',
  estimatedTimeMinutes: 45,
  status: 'draft' as const,
  lab: DISK_FORENSICS_LAB_DEFINITION,
  tasks: [],
  quiz: { questions: [] },
};

export async function seedDatabase() {
  for (const [emailKey, role, firstName, lastName] of accounts) {
    const email = process.env[emailKey];
    const password = process.env[emailKey.replace('EMAIL', 'PASSWORD')];
    if (email && password && password !== 'change_me' && !(await User.exists({ email: email.toLowerCase() }))) {
      await User.create({
        firstName,
        lastName,
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS),
        role,
      });
    }
  }

  const admin = await User.findOne({ role: 'admin' });

  const allExperiments = [
    nmapExperiment,
    dosExperiment,
    reconExperiment,
    keyloggerExperiment,
    emailForensicsExperiment,
    fileForensicsExperiment,
    diskForensicsExperiment,
    exp08Draft,
  ];

  for (const exp of allExperiments) {
    await Experiment.updateOne(
      { slug: exp.slug },
      { $set: { ...exp, createdBy: admin?._id } },
      { upsert: true, runValidators: true }
    );
  }
}

if (process.argv[1]?.includes('dbSeeder')) {
  connectDatabase()
    .then(seedDatabase)
    .then(() => {
      console.log('Seed complete.');
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
