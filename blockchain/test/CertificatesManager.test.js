import { expect } from "chai";
import { ethers } from "ethers";
import { readFile } from "fs/promises";

describe("QA Tests: CertificatesManager", function () {
  let contract;
  let adminWallet;
  let issuerWallet;
  let holderWallet;

  // Τα στάνταρ test accounts του τοπικού Node (Account #0, #1, #2)
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const adminPrivKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const issuerPrivKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const holderPrivKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

  before(async function () {
    adminWallet = new ethers.Wallet(adminPrivKey, provider);
    issuerWallet = new ethers.Wallet(issuerPrivKey, provider);
    holderWallet = new ethers.Wallet(holderPrivKey, provider);

    // Διαβάζουμε το ABI από το Compile
    const artifactData = await readFile("./artifacts/contracts/CertificatesManager.sol/CertificatesManager.json", "utf-8");
    const artifact = JSON.parse(artifactData);

    // Κάνουμε Deploy ένα φρέσκο συμβόλαιο για το Test
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, adminWallet);
    contract = await factory.deploy();
    await contract.waitForDeployment();
  });

  it("1. Πρέπει να ορίσει σωστά τα στατιστικά (0 εκδοθέντα, 0 ανακληθέντα)", async function () {
    const stats = await contract.getSystemStats();
    expect(stats[0]).to.equal(0n);
    expect(stats[1]).to.equal(0n);
  });

  it("2. Ο Admin πρέπει να μπορεί να εγγράψει νέο Issuer", async function () {
    // Role 1 = Issuer
    const tx = await contract.registerUser(issuerWallet.address, "QA Issuer", 1);
    await tx.wait();

    // Ελέγχουμε αν γράφτηκε σωστά
    const user = await contract.users(issuerWallet.address);
    expect(user.role).to.equal(1n);
    expect(user.active).to.be.true;
  });

  it("3. Ο Issuer πρέπει να μπορεί να εκδώσει Πιστοποιητικό", async function () {
    // Το συμβόλαιο συνδέεται πλέον ως "Issuer"
    const contractAsIssuer = contract.connect(issuerWallet);
    
    // Έκδοση πιστοποιητικού (ID: CERT-001, Type: 2 (Academic))
    const tx = await contractAsIssuer.issueCertificate(
      "CERT-001",
      2, 
      holderWallet.address,
      "dummy-pdf-hash-12345",
      0 // Δεν λήγει ποτέ
    );
    await tx.wait();

    // Επιβεβαίωση ότι τα στατιστικά αυξήθηκαν
    const stats = await contract.getSystemStats();
    expect(stats[0]).to.equal(1n); // totalIssued = 1
  });
});