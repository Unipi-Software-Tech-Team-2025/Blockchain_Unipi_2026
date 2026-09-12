import { ethers } from "ethers";
import { readFile } from "fs/promises";

async function main() {
  console.log("Starting Deployment & Automatic Seeding...\n");

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  
  // Hardhat test accounts
  const adminPriv = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; 
  const issuerPriv = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; 
  const revOfficerPriv = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; 
  const holderPriv = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"; 
  const auditorPriv = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a";
  const verifierPriv = "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba";

  const adminWallet = new ethers.Wallet(adminPriv, provider);
  const issuerWallet = new ethers.Wallet(issuerPriv, provider);
  const revOfficerWallet = new ethers.Wallet(revOfficerPriv, provider);
  const holderWallet = new ethers.Wallet(holderPriv, provider);
  const auditorWallet = new ethers.Wallet(auditorPriv, provider);
  const verifierWallet = new ethers.Wallet(verifierPriv, provider);

  // 1. Κάνουμε Deploy το Contract
  const artifactData = await readFile("./artifacts/contracts/CertificatesManager.sol/CertificatesManager.json", "utf-8");
  const artifact = JSON.parse(artifactData);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, adminWallet);
  
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  console.log(`Contract deployed at address: ${contract.target}`);

  // 2. Εγγραφή Χρηστών (Με ρητή διαχείριση Nonce)
  console.log("\nRegistering Users (Roles)...");
  let adminNonce = await adminWallet.getNonce(); // Get the current nonce
  
  await (await contract.registerUser(issuerWallet.address, "Unipi - CS Dept", 1, { nonce: adminNonce++ })).wait();
  await (await contract.registerUser(revOfficerWallet.address, "Ministry of Education", 4, { nonce: adminNonce++ })).wait();
  await (await contract.registerUser(holderWallet.address, "John Doe", 2, { nonce: adminNonce++ })).wait();
  await (await contract.registerUser(verifierWallet.address, "Validation Agency", 3, { nonce: adminNonce++ })).wait();
  await (await contract.registerUser(auditorWallet.address, "QA Auditor", 5, { nonce: adminNonce++ })).wait();
  console.log("Users created successfully!");

  // 3. Έκδοση 10 Πιστοποιητικών (Με ρητή διαχείριση Nonce)
  console.log("\nIssuing 10 Test Certificates...");
  const contractAsIssuer = contract.connect(issuerWallet);
  let issuerNonce = await issuerWallet.getNonce();
  
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const oneYearFromNow = currentTimestamp + (365 * 24 * 60 * 60);
  const pastDate = currentTimestamp - (10 * 24 * 60 * 60);

  const certsData = [
    { id: "CERT-001", type: 2, hash: "hash-academic-001", exp: 0 },
    { id: "CERT-002", type: 0, hash: "hash-seminar-002", exp: oneYearFromNow },
    { id: "CERT-003", type: 1, hash: "hash-prof-003", exp: oneYearFromNow },
    { id: "CERT-004", type: 3, hash: "hash-license-004", exp: pastDate },
    { id: "CERT-005", type: 2, hash: "hash-academic-005", exp: 0 },
    { id: "CERT-006", type: 0, hash: "hash-seminar-006", exp: oneYearFromNow },
    { id: "CERT-007", type: 1, hash: "hash-prof-007", exp: oneYearFromNow },
    { id: "CERT-008", type: 3, hash: "hash-license-008", exp: oneYearFromNow },
    { id: "CERT-009", type: 2, hash: "hash-academic-009", exp: 0 },
    { id: "CERT-010", type: 0, hash: "hash-seminar-010", exp: oneYearFromNow }
  ];

  for (let i = 0; i < certsData.length; i++) {
    const c = certsData[i];
    await (await contractAsIssuer.issueCertificate(c.id, c.type, holderWallet.address, c.hash, c.exp, { nonce: issuerNonce++ })).wait();
    console.log(`Issued ${c.id}`);
  }

  // 4. Revoking a certificate (Revoke)
  console.log("\nRevoking CERT-008 (For UI testing)...");
  const contractAsRevOfficer = contract.connect(revOfficerWallet);
  let revNonce = await revOfficerWallet.getNonce();
  
  await (await contractAsRevOfficer.revokeCertificate("CERT-008", "Error in grading", { nonce: revNonce++ })).wait();
  console.log("CERT-008 got revoked!");

  console.log("\nSeeding complete!");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});