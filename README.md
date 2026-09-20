# Σύστημα Διαχείρισης Ψηφιακών Πιστοποιητικών (Blockchain)

Αυτό το αποθετήριο περιέχει την υλοποίηση ενός συστήματος έκδοσης,
επαλήθευσης και ανάκλησης ψηφιακών πιστοποιητικών μέσω έξυπνου
συμβολαίου σε Solidity, τοπικού δικτύου Hardhat και διεπαφής χρήστη
(UI).

## Εργαλεία που χρησιμοποιήθηκαν

-   **Smart Contract:** Solidity (v0.8.19)
-   **Blockchain Environment:** Hardhat (Local node)
-   **Web3 Integration:** Ethers.js
-   **Testing:** Mocha / Chai (14 αυτοματοποιημένα tests)
-   **Security Audit:** Slither
-   **Frontend:** HTML, CSS, JavaScript (Vanilla)

## Ρόλοι Χρηστών

Το σύστημα υποστηρίζει 6 διακριτούς ρόλους με χρήση Role-Based Access
Control (RBAC):

1.  **Admin:** Εγγραφή χρηστών, απόδοση/ενημέρωση ρόλων και
    απενεργοποίηση.
2.  **Issuer:** Έκδοση νέων πιστοποιητικών με μοναδικό ID και file hash.
3.  **Holder:** Προβολή των προσωπικών του πιστοποιητικών.
4.  **Verifier:** Επαλήθευση εγκυρότητας πιστοποιητικού μέσω ID ή file
    hash.
5.  **Revocation Officer:** Ανάκληση πιστοποιητικού με υποχρεωτική
    αιτιολογία.
6.  **Auditor:** Εποπτεία και πρόσβαση σε συνολικά στατιστικά συστήματος
    (Total Issued / Revoked).

## Βασικές Συναρτήσεις του Συστήματος

-   `registerUser()`: Εγγραφή χρήστη από τον Admin.
-   `updateUserRole()`: Αλλαγή του ρόλου ενός εγγεγραμμένου χρήστη.
-   `deactivateUser()`: Απενεργοποίηση χρήστη.
-   `issueCertificate()`: Δημιουργία πιστοποιητικού από εξουσιοδοτημένο
    Issuer.
-   `revokeCertificate()`: Ανάκληση πιστοποιητικού από Revocation
    Officer.
-   `verifyCertificateById()` / `verifyCertificateByHash()`: Επαλήθευση
    πιστοποιητικού μέσω ID ή file hash.
-   `getHolderCertificates()`: Ανάκτηση των πιστοποιητικών συγκεκριμένου
    Holder.
-   `getIssuerCertificates()`: Ανάκτηση των πιστοποιητικών συγκεκριμένου
    Issuer.
-   `getSystemStats()`: Επιστροφή συνολικών μετρικών για τον Auditor.

## Καταγραφή Γεγονότων (Events)

Το `CertificatesManager.sol` εκπέμπει events για τις βασικές ενέργειες
του συστήματος:

-   `UserRegistered`
-   `UserRoleUpdated`
-   `UserDeactivated`
-   `CertificateIssued`
-   `CertificateRevoked`
-   `CertificateVerified`

Με αυτόν τον τρόπο οι κρίσιμες μεταβολές μπορούν να παρακολουθούνται και
να χρησιμοποιούνται για auditing.

## Δοκιμαστικά Δεδομένα

Κατά το deployment (`scripts/deploy.js`) αναπτύσσεται το
`CertificatesManager.sol`, δημιουργούνται οι προβλεπόμενοι test ρόλοι
και φορτώνονται **10 δοκιμαστικά πιστοποιητικά (mock data)**
διαφορετικών τύπων. Το `CERT-008` ανακαλείται κατά το seeding flow, ώστε
να υπάρχει διαθέσιμο παράδειγμα revoked certificate για τα UI και QA
tests.

Το local blockchain χρησιμοποιεί:

-   **RPC:** `http://127.0.0.1:8545`
-   **Chain ID:** `31337`

Η διεύθυνση contract που καταγράφηκε στην τελική εκτέλεση της εργασίας
είναι:

`0x5FC8d32690cc91D4c39d9d3abcBD16989F875707`

> Σε νέο local Hardhat deployment η διεύθυνση μπορεί να αλλάξει. Το
> deployment script ενημερώνει το contract address που χρησιμοποιείται
> από το frontend.

## Βήματα Εγκατάστασης και Εκτέλεσης

### 1. Εγκατάσταση εξαρτήσεων

``` bash
npm install
```

### 2. Compile του Smart Contract

``` bash
npx hardhat compile
```

### 3. Εκκίνηση τοπικού Hardhat node

Σε ξεχωριστό terminal:

``` bash
npx hardhat node
```

Ο Hardhat node πρέπει να παραμείνει ενεργός κατά το deployment και κατά
τη χρήση του frontend.

### 4. Deployment και Seeding

Σε δεύτερο terminal:

``` bash
npx hardhat run scripts/deploy.js --network localhost
```

Το script πραγματοποιεί deployment του contract και αρχικοποιεί τα test
δεδομένα.

### 5. Εκκίνηση της Διεπαφής Χρήστη

Μέσα στον φάκελο του frontend μπορεί να χρησιμοποιηθεί ένας απλός local
HTTP server:

``` bash
python -m http.server 5500
```

Στη συνέχεια ανοίξτε στον browser:

`http://localhost:5500`

Η εφαρμογή συνδέεται με το local Hardhat network μέσω Ethers.js και
χρησιμοποιεί το contract address της τρέχουσας εκτέλεσης.

## Τρόπος Εκτέλεσης Ελέγχων (QA & Security Audit)

### Αυτοματοποιημένες Δοκιμές (Mocha)

Με ενεργό το local Hardhat environment:

``` bash
npx mocha test/CertificatesManager.test.js
```

Η τελική QA suite της εργασίας περιλαμβάνει **14 tests** και το τελικό
καταγεγραμμένο αποτέλεσμα είναι:

``` text
14 passing
```

Τα tests καλύπτουν RBAC, issuance, verification, authorized/unauthorized
revocation, duplicate Certificate IDs, duplicate file hashes, double
revocation, deactivated users και dynamic expiration.

### Έλεγχος Ασφάλειας με Slither

Με εγκατεστημένο Python/Slither:

``` bash
slither contracts/CertificatesManager.sol
```

Στην τελική ανάλυση καταγράφηκαν:

-   **High:** 0
-   **Medium:** 0
-   **Low:** 0
-   **Informational:** 21

Οι informational παρατηρήσεις αφορούν κυρίως naming conventions.

## Βασική Δομή Project

``` text
blockchain/
├── contracts/
│   └── CertificatesManager.sol
├── scripts/
│   └── deploy.js
├── test/
│   └── CertificatesManager.test.js
├── hardhat.config.ts
├── package.json
└── README.md
```

Ο πηγαίος κώδικας του frontend παραδίδεται μαζί με το project στον
αντίστοιχο φάκελο UI/frontend.

## Σημείωση

Το project έχει αναπτυχθεί και ελεγχθεί σε local Hardhat environment. Τα
αποτελέσματα QA και Slither που αναφέρονται παραπάνω αντιστοιχούν στην
τελική έκδοση που τεκμηριώνεται στο συνοδευτικό report.
