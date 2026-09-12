/* =========================================================================
   ΣΥΝΔΕΣΗ ΜΕ ΤΟ ΠΡΑΓΜΑΤΙΚΟ SMART CONTRACT (ethers.js)
   Χρειάζεται να τρέχει το τοπικό δίκτυο (run_setup.bat) στο 127.0.0.1:8545.
========================================================================= */
const CONTRACT_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
const RPC_URL = "http://127.0.0.1:8545";

const CONTRACT_ABI = [
  "function users(address) view returns (address userAddress, string name, uint8 role, bool active)",
  "function registerUser(address _userAddress, string _name, uint8 _role)",
  "function updateUserRole(address _userAddress, uint8 _newRole)",
  "function deactivateUser(address _userAddress)",
  "function reactivateUser(address _userAddress)",
  "function issueCertificate(string _certificateId, uint8 _certType, address _holder, string _fileHash, uint256 _expiryDate)",
  "function revokeCertificate(string _certificateId, string _reason)",
  "function verifyCertificateById(string _certificateId) returns (uint8 certType, address issuer, address holder, uint256 issueDate, uint256 expiryDate, uint8 status, string revocationReason)",
  "function verifyCertificateByHash(string _fileHash) returns (string certificateId, uint8 status)",
  "function getHolderCertificates(address _holder) view returns (string[])",
  "function getIssuerCertificates(address _issuer) view returns (string[])",
  "function getTotalCertificatesCount() view returns (uint256)",
  "function getCertificateIdByIndex(uint256 index) view returns (string)",
  "function getSystemStats() view returns (uint256 _totalIssued, uint256 _totalRevoked)",
  "event UserRegistered(address indexed userAddress, uint8 role, string name)",
  "event UserRoleUpdated(address indexed userAddress, uint8 newRole)",
  "event UserDeactivated(address indexed userAddress)",
  "event UserReactivated(address indexed userAddress)",
  "event CertificateIssued(string indexed certificateId, address indexed issuer, address indexed holder, string fileHash)",
  "event CertificateRevoked(string indexed certificateId, address indexed revocationOfficer, string reason)",
  "event CertificateVerified(string indexed certificateId, address indexed verifier)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const roContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider); // read-only κλήσεις
function signedContract() { return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, session.wallet); }

// Η σειρά ΠΡΕΠΕΙ να ταιριάζει ακριβώς με τα enums μέσα στο CertificatesManager.sol
const ROLE_NAMES = ["Admin", "Issuer", "Holder", "Verifier", "RevocationOfficer", "Auditor"];
const CERT_TYPES = ["Σεμινάριο", "Επαγγελματική Πιστοποίηση", "Ακαδημαϊκή Βεβαίωση", "Άδεια"];
const STATUS_NAMES = ["Active", "Expired", "Revoked"];
function certTypeLabel(idx) { return CERT_TYPES[Number(idx)] ?? "Άγνωστο"; }

// Υπολογισμός SHA-256 hash από πραγματικό αρχείο, εξ ολοκλήρου στον browser.
async function computeFileHash(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Χάρτης address -> όνομα, για να δείχνουμε ονόματα αντί για ωμές διευθύνσεις.
async function buildAddressNameMap() {
  const users = await loadAllUsers();
  const map = {};
  users.forEach(u => { map[u.address.toLowerCase()] = u.name; });
  return map;
}
function nameOrAddr(address, nameMap) {
  if (!address) return "—";
  const n = nameMap && nameMap[address.toLowerCase()];
  return n ? n + " (" + shortAddr(address) + ")" : shortAddr(address);
}

// Μετατροπή σφαλμάτων ethers/Solidity σε κατανοητό μήνυμα
function friendlyError(err) {
  return err?.reason || err?.shortMessage || err?.message || "Άγνωστο σφάλμα.";
}

/* -------------------------------------------------------------------------
   ΚΑΤΑΣΤΑΣΗ ΕΦΑΡΜΟΓΗΣ
------------------------------------------------------------------------- */
let session = null; // { address, wallet, name, roleIdx, role }

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}

function showView(name) {
  document.getElementById("view-login").style.display = name === "login" ? "flex" : "none";
  document.getElementById("view-register").style.display = name === "register" ? "flex" : "none";
  document.getElementById("view-app").classList.toggle("active", name === "app");
}

function logout() {
  session = null;
  showView("login");
}

function shortAddr(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : "—"; }

/* -------------------------------------------------------------------------
   LOGIN — με Private Key αντί για email/κωδικό
------------------------------------------------------------------------- */
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pk = document.getElementById("login-pk").value.trim();
  try {
    const wallet = new ethers.Wallet(pk, provider);
    const u = await roContract.users(wallet.address);
    if (!u.active) {
      showToast("Αυτή η διεύθυνση δεν είναι καταχωρημένη/ενεργή. Ζήτησε από τον Admin να σε προσθέσει.");
      return;
    }
    session = { address: wallet.address, wallet, name: u.name, roleIdx: Number(u.role), role: ROLE_NAMES[Number(u.role)] };
    enterApp();
  } catch (err) {
    showToast("Μη έγκυρο private key ή αδυναμία σύνδεσης με το τοπικό δίκτυο (τρέχει το run_setup.bat;).");
  }
});

/* -------------------------------------------------------------------------
   ΠΛΟΗΓΗΣΗ ΑΝΑ ΡΟΛΟ
------------------------------------------------------------------------- */
const ROLE_LABELS = {
  Admin: "Διαχειριστής", Issuer: "Φορέας Έκδοσης", Holder: "Κάτοχος",
  Verifier: "Επαληθευτής", RevocationOfficer: "Υπεύθυνος Ανάκλησης", Auditor: "Ελεγκτής"
};

const ROLE_SECTIONS = {
  Admin: [{ id: "users", label: "Χρήστες & Ρόλοι" }],
  Issuer: [{ id: "issue", label: "Έκδοση Πιστοποιητικού" }, { id: "myissued", label: "Πιστοποιητικά που εξέδωσα" }],
  Holder: [{ id: "mycerts", label: "Τα Πιστοποιητικά μου" }],
  Verifier: [{ id: "verify", label: "Επαλήθευση Πιστοποιητικού" }],
  RevocationOfficer: [{ id: "revoke", label: "Ανάκληση Πιστοποιητικού" }],
  Auditor: [{ id: "allcerts", label: "Όλα τα Πιστοποιητικά" }, { id: "allusers", label: "Όλοι οι Χρήστες" }],
};

function enterApp() {
  document.getElementById("sidebar-role").textContent = ROLE_LABELS[session.role] || session.role;
  document.getElementById("sidebar-user").textContent = session.name + " (" + shortAddr(session.address) + ")";

  const nav = document.getElementById("nav-list");
  nav.innerHTML = "";
  const sections = ROLE_SECTIONS[session.role] || [];
  sections.forEach((s, i) => {
    const a = document.createElement("a");
    a.className = "nav-item" + (i === 0 ? " active" : "");
    a.textContent = s.label;
    a.onclick = () => { selectSection(s.id, a); };
    nav.appendChild(a);
  });

  showView("app");
  if (sections.length) renderSection(sections[0].id);
}

function selectSection(id, el) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  el.classList.add("active");
  renderSection(id);
}

function statusBadge(statusIdx) {
  const name = STATUS_NAMES[Number(statusIdx)] || "Active";
  const map = { Active: ["status-active", "Ενεργό"], Expired: ["status-expired", "Ληγμένο"], Revoked: ["status-revoked", "Ανακλημένο"] };
  const pair = map[name];
  return '<span class="status ' + pair[0] + '">' + pair[1] + '</span>';
}

function fmtDate(ts) {
  ts = Number(ts);
  if (!ts) return "—"; // 0 = ποτέ δεν λήγει / δεν έχει οριστεί
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------
   RENDER: κάθε συνάρτηση φτιάχνει το περιεχόμενο μιας ενότητας
------------------------------------------------------------------------- */
const main = () => document.getElementById("main-content");

function renderSection(id) {
  const renderers = {
    users: renderAdminUsers,
    issue: renderIssuerIssue, myissued: renderIssuerMine,
    mycerts: renderHolderCerts,
    verify: renderVerifier,
    revoke: renderRevocation,
    allcerts: renderAuditorCerts, allusers: renderAuditorUsers,
  };
  (renderers[id] || (() => { main().innerHTML = ""; }))();
}

// ---- Γενικός μηχανισμός αναζήτησης πίνακα ----
window.__tableState = {};
function renderSearchableTable(sectionId, items, headerHtml, rowFn, searchFn, placeholder) {
  window.__tableState[sectionId] = { items, headerHtml, rowFn, searchFn };
  return '<div class="field" style="max-width:320px;">' +
      '<input type="text" id="search-' + sectionId + '" placeholder="' + placeholder + '" oninput="filterTable(\'' + sectionId + '\')">' +
    '</div>' +
    '<div id="table-wrap-' + sectionId + '"></div>';
}
function paintTable(sectionId) {
  const st = window.__tableState[sectionId];
  const wrap = document.getElementById('table-wrap-' + sectionId);
  if (!st.items.length) { wrap.innerHTML = '<div class="empty-state">Δεν υπάρχουν ακόμα εγγραφές.</div>'; return; }
  wrap.innerHTML = '<table><thead><tr>' + st.headerHtml + '</tr></thead><tbody>' + st.items.map(st.rowFn).join("") + '</tbody></table>';
}
function filterTable(sectionId) {
  const full = window.__tableState[sectionId].__full || window.__tableState[sectionId].items;
  window.__tableState[sectionId].__full = full;
  const q = (document.getElementById('search-' + sectionId).value || "").toLowerCase().trim();
  window.__tableState[sectionId].items = q ? full.filter(it => window.__tableState[sectionId].searchFn(it, q)) : full;
  paintTable(sectionId);
}

/* -------------------------------------------------------------------------
   Βοηθητικό: το contract ΔΕΝ έχει "πάρε όλους τους χρήστες".
   Ανακατασκευάζουμε τη λίστα διαβάζοντας τα UserRegistered events (logs),
   και μετά ρωτάμε το τρέχον status/ρόλο του καθενός (πιο αξιόπιστο από το
   να ξαναπαίξουμε τα events με τη σειρά).
------------------------------------------------------------------------- */
async function loadAllUsers() {
  const logs = await roContract.queryFilter(roContract.filters.UserRegistered());
  const addresses = [...new Set(logs.map(l => l.args.userAddress))];
  const users = await Promise.all(addresses.map(async (addr) => {
    const u = await roContract.users(addr);
    return { address: addr, name: u.name, roleIdx: Number(u.role), role: ROLE_NAMES[Number(u.role)], active: u.active };
  }));
  return users;
}

// ---- Admin: Χρήστες & Ρόλοι ----
async function renderAdminUsers() {
  const items = await loadAllUsers();
  const headerHtml = "<th>Όνομα</th><th>Διεύθυνση</th><th>Ρόλος</th><th>Κατάσταση</th><th></th>";
  const rowFn = (u) => (
    '<tr>' +
      '<td>' + u.name + '</td>' +
      '<td class="mono">' + u.address + '</td>' +
      '<td><select onchange="changeUserRole(\'' + u.address + '\', this.value)" ' + (!u.active ? "disabled" : "") + '>' +
        ROLE_NAMES.map((r, i) => '<option value="' + i + '" ' + (i===u.roleIdx?"selected":"") + '>' + r + '</option>').join("") +
      '</select></td>' +
      '<td>' + (u.active ? '<span class="status status-active">Ενεργός</span>' : '<span class="status status-revoked">Ανενεργός</span>') + '</td>' +
      '<td>' + (u.active ? '<button class="btn btn-danger btn-sm" onclick="deactivateUserUI(\'' + u.address + '\')">Απενεργοποίηση</button>' : '<button class="btn btn-outline btn-sm" onclick="reactivateUserUI(\'' + u.address + '\')">Ενεργοποίηση</button>') + '</td>' +
    '</tr>'
  );
  const searchFn = (u, q) => u.name.toLowerCase().includes(q) || u.address.toLowerCase().includes(q);

  main().innerHTML =
    '<div class="main-header"><h1>Χρήστες &amp; Ρόλοι</h1><p>Διαχείριση εγγεγραμμένων χρηστών του συστήματος (on-chain).</p></div>' +
    '<div class="panel"><h2>Νέος χρήστης</h2>' +
      '<form id="new-user-form">' +
        '<div class="grid-2">' +
          '<div class="field"><label>Διεύθυνση (wallet address)</label>' +
            '<input type="text" id="nu-address" placeholder="0x..." required>' +
            '<button type="button" class="btn btn-outline btn-sm" style="margin-top:8px;" onclick="generateWallet()">Δημιούργησε Wallet</button>' +
            '<div id="generated-wallet-box"></div>' +
          '</div>' +
          '<div class="field"><label>Ονοματεπώνυμο / Επωνυμία Φορέα</label><input type="text" id="nu-name" placeholder="π.χ. Γιάννης Παπαδόπουλος ή Πανεπιστήμιο Β" required></div>' +
        '</div>' +
        '<div class="field"><label>Ρόλος</label><select id="nu-role">' +
          ROLE_NAMES.map((r, i) => '<option value="' + i + '">' + r + '</option>').join("") +
        '</select></div>' +
        '<button class="btn btn-primary" type="submit" style="width:auto;">Καταχώρηση Χρήστη</button>' +
      '</form>' +
    '</div>' +
    '<div class="panel"><h2>Καταχωρημένοι χρήστες</h2>' +
      renderSearchableTable("admin-users", items, headerHtml, rowFn, searchFn, "Αναζήτηση με όνομα ή διεύθυνση…") +
    '</div>';
  paintTable("admin-users");

  document.getElementById("new-user-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const tx = await signedContract().registerUser(
        document.getElementById("nu-address").value.trim(),
        document.getElementById("nu-name").value,
        parseInt(document.getElementById("nu-role").value)
      );
      await tx.wait();
      showToast("Ο χρήστης καταχωρήθηκε στο blockchain.");
      e.target.reset();
      renderAdminUsers();
    } catch (err) { showToast("Σφάλμα: " + friendlyError(err)); }
  });
}
function pickHolder(address, name) {
  selectedHolderAddress = address;
  document.getElementById("issue-holder").value = name;
  document.getElementById("issue-holder-suggestions").innerHTML = "";
}

function generateWallet() {
  const w = ethers.Wallet.createRandom();
  document.getElementById("nu-address").value = w.address;
  const box = document.getElementById("generated-wallet-box");
  box.innerHTML =
    '<div class="banner" style="margin-top:10px;">' +
      '<strong>Νέο Private Key (εμφανίζεται μία φορά — αντίγραψέ το τώρα):</strong><br>' +
      '<span class="mono" id="generated-pk" style="word-break:break-all;">' + w.privateKey + '</span><br>' +
      '<button type="button" class="btn btn-outline btn-sm" style="margin-top:8px;" onclick="copyGeneratedKey()">Αντιγραφή Private Key</button>' +
      '<div class="field-hint" style="margin-top:6px;">Στείλε αυτό το κλειδί μόνο στο άτομο που θα είναι αυτός ο χρήστης — η εφαρμογή δεν το αποθηκεύει πουθενά.</div>' +
    '</div>';
  showToast("Δημιουργήθηκε νέο wallet.");
}
function copyGeneratedKey() {
  const pk = document.getElementById("generated-pk").textContent;
  navigator.clipboard.writeText(pk).then(() => showToast("Το private key αντιγράφηκε."));
}
async function changeUserRole(address, roleIdx) {
  try {
    const tx = await signedContract().updateUserRole(address, parseInt(roleIdx));
    await tx.wait();
    showToast("Ο ρόλος ενημερώθηκε.");
  } catch (err) { showToast("Σφάλμα: " + friendlyError(err)); }
  renderAdminUsers();
}
async function deactivateUserUI(address) {
  try {
    const tx = await signedContract().deactivateUser(address);
    await tx.wait();
    showToast("Ο χρήστης απενεργοποιήθηκε.");
  } catch (err) { showToast("Σφάλμα: " + friendlyError(err)); }
  renderAdminUsers();
}
async function reactivateUserUI(address) {
  try {
    const tx = await signedContract().reactivateUser(address);
    await tx.wait();
    showToast("Ο χρήστης επανενεργοποιήθηκε.");
  } catch (err) { showToast("Σφάλμα: " + friendlyError(err)); }
  renderAdminUsers();
}

// ---- Issuer: Έκδοση ----
let selectedHolderAddress = null;

async function renderIssuerIssue() {
  main().innerHTML =
    '<div class="main-header"><h1>Έκδοση Πιστοποιητικού</h1><p>Συμπλήρωσε τα στοιχεία του νέου πιστοποιητικού.</p></div>' +
    '<div class="panel"><h2>Νέο πιστοποιητικό</h2>' +
      '<form id="issue-form">' +
        '<div class="grid-2">' +
          '<div class="field"><label>ID Πιστοποιητικού</label><input type="text" id="issue-id" placeholder="π.χ. CERT-011" required></div>' +
          '<div class="field"><label>Τύπος πιστοποιητικού</label><select id="issue-type">' +
            CERT_TYPES.map((t, i) => '<option value="' + i + '">' + t + '</option>').join("") +
          '</select></div>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div class="field" style="position:relative;"><label>Κάτοχος (Holder)</label>' +
            '<input type="text" id="issue-holder" placeholder="Γράψε όνομα ή διεύθυνση για αναζήτηση..." autocomplete="off" required>' +
            '<div id="issue-holder-suggestions"></div>' +
            '<div class="field-hint">Γράψε όνομα ή διεύθυνση και επίλεξε από τη λίστα — εμφανίζονται μόνο καταχωρημένοι Holders.</div>' +
          '</div>' +
          '<div class="field"><label>Ημερομηνία λήξης</label><input type="date" id="issue-expiry">' +
            '<div class="field-hint">Κενό = δεν λήγει ποτέ.</div></div>' +
        '</div>' +
        '<div class="field"><label>Αρχείο πιστοποιητικού</label><input type="file" id="issue-file">' +
          '<div class="field-hint">Ανέβασε το πραγματικό αρχείο — το hash του θα υπολογιστεί αυτόματα από κάτω.</div></div>' +
        '<div class="field"><label>fileHash *</label><input type="text" id="issue-hash" placeholder="θα υπολογιστεί αυτόματα από το αρχείο" required>' +
          '<div class="field-hint">Υποχρεωτικό και μοναδικό — το contract απορρίπτει διπλότυπο hash.</div></div>' +
        '<button class="btn btn-primary" type="submit" style="width:auto;">Έκδοση Πιστοποιητικού</button>' +
      '</form>' +
    '</div>';

  // Φορτώνουμε μία φορά τους καταχωρημένους Holders, για τις προτάσεις ονόματος.
  selectedHolderAddress = null;
  const allUsers = await loadAllUsers();
  const holders = allUsers.filter(u => u.role === "Holder" && u.active);

  // Πρόταση επόμενου διαθέσιμου ID (π.χ. CERT-011) — παραμένει επεξεργάσιμο.
  try {
    const total = Number(await roContract.getTotalCertificatesCount());
    document.getElementById("issue-id").value = "CERT-" + String(total + 1).padStart(3, "0");
  } catch (e) { /* αν αποτύχει, το πεδίο μένει κενό προς συμπλήρωση */ }

  // Αυτόματος υπολογισμός fileHash από το πραγματικό αρχείο.
  const fileInput = document.getElementById("issue-file");
  const hashInput = document.getElementById("issue-hash");
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) { hashInput.readOnly = false; return; }
    hashInput.value = "Υπολογισμός...";
    hashInput.readOnly = true;
    hashInput.value = await computeFileHash(file);
    showToast("Το hash υπολογίστηκε αυτόματα από το αρχείο.");
  });

  const holderInput = document.getElementById("issue-holder");
  const suggestBox = document.getElementById("issue-holder-suggestions");

  holderInput.addEventListener("input", () => {
    const q = holderInput.value.trim().toLowerCase();
    selectedHolderAddress = null; // κάθε νέο πληκτρολόγημα ακυρώνει προηγούμενη επιλογή
    if (!q) { suggestBox.innerHTML = ""; return; }
    const matches = holders.filter(u =>
      u.name.toLowerCase().includes(q) || u.address.toLowerCase().includes(q)
    );
    if (!matches.length) {
      suggestBox.innerHTML = '<div class="suggestion-item" style="color:var(--text-dim); cursor:default;">Κανένας καταχωρημένος Holder δεν ταιριάζει</div>';
      return;
    }
    suggestBox.innerHTML = matches.map(u =>
      '<div class="suggestion-item" onclick="pickHolder(\'' + u.address + '\', \'' + u.name.replace(/'/g, "\\'") + '\')">' +
        u.name + ' <span class="mono">(' + shortAddr(u.address) + ')</span>' +
      '</div>'
    ).join("");
  });
  document.addEventListener("click", (e) => {
    if (e.target !== holderInput) suggestBox.innerHTML = "";
  });

  document.getElementById("issue-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedHolderAddress) {
      showToast("Διάλεξε τον κάτοχο κάνοντας κλικ σε μια από τις προτάσεις — πρέπει να είναι ήδη καταχωρημένος Holder.");
      return;
    }
    const holderAddress = selectedHolderAddress;
    const expiryVal = document.getElementById("issue-expiry").value;
    const expiryUnix = expiryVal ? Math.floor(new Date(expiryVal + "T00:00:00Z").getTime() / 1000) : 0;
    try {
      const tx = await signedContract().issueCertificate(
        document.getElementById("issue-id").value.trim(),
        parseInt(document.getElementById("issue-type").value),
        holderAddress,
        document.getElementById("issue-hash").value.trim(),
        expiryUnix
      );
      await tx.wait();
      showToast("Το πιστοποιητικό εκδόθηκε στο blockchain.");
      e.target.reset();
    } catch (err) { showToast("Σφάλμα: " + friendlyError(err)); }
  });
}

// Παίρνει μια λίστα IDs και επιστρέφει πλήρη στοιχεία μέσω verifyCertificateById
// (staticCall -> στιγμιαίο, χωρίς gas, χωρίς πραγματική συναλλαγή)
async function loadCertsByIds(ids) {
  const contractToUse = session?.wallet ? signedContract() : roContract;
  return Promise.all(ids.map(async (id) => {
    const r = await contractToUse.verifyCertificateById.staticCall(id);
    return {
      id: id, certType: Number(r.certType), issuer: r.issuer, holder: r.holder,
      issueDate: fmtDate(r.issueDate), expiryDate: fmtDate(r.expiryDate),
      status: Number(r.status), revocationReason: r.revocationReason
    };
  }));
}

async function renderIssuerMine() {
  const ids = await roContract.getIssuerCertificates(session.address);
  const items = await loadCertsByIds(ids);
  const nameMap = await buildAddressNameMap();
  renderCertTable("issuer-mine", "Πιστοποιητικά που εξέδωσα", items, ["holder"], "Αναζήτηση με ID, τύπο ή κάτοχο…", nameMap);
}

// ---- Holder ----
async function renderHolderCerts() {
  const ids = await roContract.getHolderCertificates(session.address);
  const items = await loadCertsByIds(ids);
  const nameMap = await buildAddressNameMap();
  renderCertTable("holder-certs", "Τα Πιστοποιητικά μου", items, ["issuer"], "Αναζήτηση με ID, τύπο ή φορέα…", nameMap);
}

// ---- Verifier ----
function renderVerifier() {
  main().innerHTML =
    '<div class="main-header"><h1>Επαλήθευση Πιστοποιητικού</h1><p>Έλεγξε αν ένα πιστοποιητικό είναι γνήσιο και ενεργό.</p></div>' +
    '<div class="panel"><h2>Αναζήτηση</h2>' +
      '<form id="verify-form">' +
        '<div class="field"><label>ID ή hash πιστοποιητικού</label><input type="text" id="verify-key" placeholder="π.χ. CERT-001, ή ανέβασε το αρχείο από κάτω" required></div>' +
        '<div class="field"><label>Ή ανέβασε το αρχείο πιστοποιητικού</label><input type="file" id="verify-file">' +
          '<div class="field-hint">Το hash υπολογίζεται αυτόματα από το αρχείο και συμπληρώνει το παραπάνω πεδίο.</div></div>' +
        '<button class="btn btn-primary" type="submit" style="width:auto;">Επαλήθευση</button>' +
      '</form>' +
      '<div class="verify-result" id="verify-result"></div>' +
    '</div>';
  document.getElementById("verify-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = document.getElementById("verify-key").value.trim();
    const box = document.getElementById("verify-result");
    const contractToUse = session?.wallet ? signedContract() : roContract;
    try {
      let r;
      try { r = await contractToUse.verifyCertificateById.staticCall(key); }
      catch {
        const byHash = await contractToUse.verifyCertificateByHash.staticCall(key);
        r = await contractToUse.verifyCertificateById.staticCall(byHash.certificateId);
      }
      const [issuerUser, holderUser] = await Promise.all([roContract.users(r.issuer), roContract.users(r.holder)]);
      const isValid = Number(r.status) === 0; // 0 = Active
      box.className = "verify-result " + (isValid ? "valid" : "invalid");
      box.innerHTML =
        '<strong>' + (isValid ? "✓ Έγκυρο πιστοποιητικό" : "✗ Μη έγκυρο/ανακλημένο/ληγμένο") + '</strong><dl>' +
        '<dt>Τύπος</dt><dd>' + certTypeLabel(r.certType) + '</dd>' +
        '<dt>Φορέας</dt><dd>' + (issuerUser.name || shortAddr(r.issuer)) + ' <span class="mono">(' + shortAddr(r.issuer) + ')</span></dd>' +
        '<dt>Κάτοχος</dt><dd>' + (holderUser.name || shortAddr(r.holder)) + ' <span class="mono">(' + shortAddr(r.holder) + ')</span></dd>' +
        '<dt>Ημ. έκδοσης</dt><dd>' + fmtDate(r.issueDate) + '</dd>' +
        '<dt>Ημ. λήξης</dt><dd>' + fmtDate(r.expiryDate) + '</dd>' +
        '<dt>Κατάσταση</dt><dd>' + statusBadge(r.status) + '</dd>' +
        (r.revocationReason ? '<dt>Λόγος ανάκλησης</dt><dd>' + r.revocationReason + '</dd>' : "") +
        '</dl>';
    } catch (err) {
      box.className = "verify-result invalid";
      box.innerHTML = '<strong>✗ Δεν βρέθηκε πιστοποιητικό με αυτό το ID/hash.</strong>';
    }
  });

  document.getElementById("verify-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const hash = await computeFileHash(file);
    document.getElementById("verify-key").value = hash;
    showToast("Υπολογίστηκε το hash του αρχείου — πάτησε Επαλήθευση.");
  });
}

// ---- RevocationOfficer ----
async function renderRevocation() {
  main().innerHTML =
    '<div class="main-header"><h1>Ανάκληση Πιστοποιητικού</h1><p>Βρες το πιστοποιητικό μέσω του κατόχου, ή γράψε απευθείας το ID αν το ξέρεις ήδη.</p></div>' +
    '<div class="panel"><h2>Αναζήτηση κατόχου</h2>' +
      '<div class="field" style="position:relative; max-width:420px;">' +
        '<label>Όνομα ή διεύθυνση κατόχου</label>' +
        '<input type="text" id="revoke-holder-search" placeholder="π.χ. John Doe ή 0x..." autocomplete="off">' +
        '<div id="revoke-holder-suggestions"></div>' +
      '</div>' +
      '<div id="revoke-holder-certs"></div>' +
    '</div>' +
    '<div class="panel"><h2>Ανάκληση</h2>' +
      '<form id="revoke-form">' +
        '<div class="field"><label>ID πιστοποιητικού</label><input type="text" id="revoke-id" placeholder="π.χ. CERT-002" required></div>' +
        '<div class="field"><label>Λόγος ανάκλησης</label><textarea id="revoke-reason" rows="3" required></textarea></div>' +
        '<button class="btn btn-danger" type="submit" style="width:auto;">Ανάκληση</button>' +
      '</form>' +
    '</div>';

  const allUsers = await loadAllUsers();
  const holders = allUsers.filter(u => u.role === "Holder" && u.active);
  const searchInput = document.getElementById("revoke-holder-search");
  const suggestBox = document.getElementById("revoke-holder-suggestions");
  const certsBox = document.getElementById("revoke-holder-certs");

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    certsBox.innerHTML = "";
    if (!q) { suggestBox.innerHTML = ""; return; }
    const matches = holders.filter(u => u.name.toLowerCase().includes(q) || u.address.toLowerCase().includes(q));
    if (!matches.length) {
      suggestBox.innerHTML = '<div class="suggestion-item" style="color:var(--text-dim); cursor:default;">Κανένας κάτοχος δεν ταιριάζει</div>';
      return;
    }
    suggestBox.innerHTML = matches.map(u =>
      '<div class="suggestion-item" onclick="pickRevokeHolder(\'' + u.address + '\', \'' + u.name.replace(/'/g, "\\'") + '\')">' +
        u.name + ' <span class="mono">(' + shortAddr(u.address) + ')</span>' +
      '</div>'
    ).join("");
  });
  document.addEventListener("click", (e) => {
    if (e.target !== searchInput) suggestBox.innerHTML = "";
  });

  document.getElementById("revoke-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("revoke-id").value.trim();
    try {
      const tx = await signedContract().revokeCertificate(id, document.getElementById("revoke-reason").value);
      await tx.wait();
      showToast("Το πιστοποιητικό " + id + " ανακλήθηκε.");
      e.target.reset();
    } catch (err) { showToast("Σφάλμα: " + friendlyError(err)); }
  });
}

async function pickRevokeHolder(address, name) {
  document.getElementById("revoke-holder-search").value = name;
  document.getElementById("revoke-holder-suggestions").innerHTML = "";
  const certsBox = document.getElementById("revoke-holder-certs");
  certsBox.innerHTML = '<div class="field-hint">Φόρτωση πιστοποιητικών…</div>';
  const ids = await roContract.getHolderCertificates(address);
  const items = await loadCertsByIds(ids);
  if (!items.length) {
    certsBox.innerHTML = '<div class="empty-state">Ο ' + name + ' δεν έχει πιστοποιητικά.</div>';
    return;
  }
  certsBox.innerHTML =
    '<table style="margin-top:14px;"><thead><tr><th>ID</th><th>Τύπος</th><th>Κατάσταση</th><th></th></tr></thead><tbody>' +
    items.map(c =>
      '<tr><td class="mono">' + c.id + '</td><td>' + certTypeLabel(c.certType) + '</td><td>' + statusBadge(c.status) + '</td>' +
      '<td>' + (Number(c.status) === 2
        ? '<span class="field-hint">Ήδη ανακλημένο</span>'
        : '<button type="button" class="btn btn-outline btn-sm" onclick="pickCertToRevoke(\'' + c.id + '\')">Επίλεξε για ανάκληση</button>') +
      '</td></tr>'
    ).join("") +
    '</tbody></table>';
}
function pickCertToRevoke(id) {
  document.getElementById("revoke-id").value = id;
  document.getElementById("revoke-reason").focus();
}

// ---- Auditor ----
async function renderAuditorCerts() {
  const total = Number(await roContract.getTotalCertificatesCount());
  const ids = [];
  for (let i = 0; i < total; i++) ids.push(await roContract.getCertificateIdByIndex(i));
  const items = await loadCertsByIds(ids);
  const nameMap = await buildAddressNameMap();

  let stats = null;
  try { stats = await signedContract().getSystemStats(); } catch (e) { /* χωρίς στατιστικά αν αποτύχει */ }

  main().innerHTML =
    '<div class="main-header"><h1>Όλα τα Πιστοποιητικά</h1>' +
      (stats ? '<p>Σύνολο εκδόσεων: ' + stats[0] + ' · Σύνολο ανακλήσεων: ' + stats[1] + '</p>' : "") +
    '</div><div class="panel"></div>';
  renderCertTableInto("auditor-certs", items, ["issuer", "holder"], "Αναζήτηση με ID, τύπο, φορέα ή κάτοχο…", nameMap);
}
async function renderAuditorUsers() {
  const items = await loadAllUsers();
  const headerHtml = "<th>Όνομα</th><th>Διεύθυνση</th><th>Ρόλος</th><th>Κατάσταση</th>";
  const rowFn = (u) => '<tr><td>' + u.name + '</td><td class="mono">' + u.address + '</td><td>' + ROLE_LABELS[u.role] + '</td><td>' + (u.active ? "Ενεργός" : "Ανενεργός") + '</td></tr>';
  const searchFn = (u, q) => u.name.toLowerCase().includes(q) || u.address.toLowerCase().includes(q);
  main().innerHTML =
    '<div class="main-header"><h1>Όλοι οι Χρήστες</h1><p>Πλήρης λίστα χρηστών του συστήματος, μόνο για εποπτεία.</p></div>' +
    '<div class="panel">' + renderSearchableTable("auditor-users", items, headerHtml, rowFn, searchFn, "Αναζήτηση με όνομα ή διεύθυνση…") + '</div>';
  paintTable("auditor-users");
}

// ---- Κοινό: πίνακας πιστοποιητικών με αναζήτηση ----
function renderCertTable(sectionId, title, items, extraCols, placeholder, nameMap) {
  main().innerHTML = '<div class="main-header"><h1>' + title + '</h1></div><div class="panel"></div>';
  renderCertTableInto(sectionId, items, extraCols, placeholder, nameMap);
}
function renderCertTableInto(sectionId, items, extraCols, placeholder, nameMap) {
  const colHeaders = { issuer: "Φορέας", holder: "Κάτοχος" };
  const headerHtml = "<th>ID</th><th>Τύπος</th>" + extraCols.map(c => "<th>" + colHeaders[c] + "</th>").join("") + "<th>Έκδοση</th><th>Λήξη</th><th>Κατάσταση</th><th>Λόγος Ανάκλησης</th>";
  const rowFn = (c) => (
    '<tr>' +
      '<td class="mono">' + c.id + '</td>' +
      '<td>' + certTypeLabel(c.certType) + '</td>' +
      extraCols.map(col => '<td>' + nameOrAddr(c[col], nameMap) + '</td>').join("") +
      '<td>' + (c.issueDate || "—") + '</td>' +
      '<td>' + (c.expiryDate || "—") + '</td>' +
      '<td>' + statusBadge(c.status) + '</td>' +
      '<td>' + (Number(c.status) === 2 && c.revocationReason ? c.revocationReason : "—") + '</td>' +
    '</tr>'
  );
  const searchFn = (c, q) =>
    String(c.id).toLowerCase().includes(q) ||
    certTypeLabel(c.certType).toLowerCase().includes(q) ||
    (c.revocationReason || "").toLowerCase().includes(q) ||
    extraCols.some(col => (c[col] || "").toLowerCase().includes(q) || nameOrAddr(c[col], nameMap).toLowerCase().includes(q));

  const panel = main().querySelector(".panel");
  panel.innerHTML = renderSearchableTable(sectionId, items, headerHtml, rowFn, searchFn, placeholder);
  paintTable(sectionId);
}
