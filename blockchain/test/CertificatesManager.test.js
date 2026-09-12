import { expect } from "chai";
import { ethers } from "ethers";
import { readFile } from "fs/promises";

describe("QA Tests: CertificatesManager", function () {
  let contract;
  let adminWallet;
  let issuerWallet;
  let holderWallet;
  let auditorWallet;

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  const adminPrivKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const issuerPrivKey =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const holderPrivKey =
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
  const auditorPrivKey =
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a";

  before(async function () {
    adminWallet = new ethers.Wallet(adminPrivKey, provider);
    issuerWallet = new ethers.Wallet(issuerPrivKey, provider);
    holderWallet = new ethers.Wallet(holderPrivKey, provider);
    auditorWallet = new ethers.Wallet(auditorPrivKey, provider);

    const artifactData = await readFile(
      "./artifacts/contracts/CertificatesManager.sol/CertificatesManager.json",
      "utf-8"
    );
    const artifact = JSON.parse(artifactData);

    const factory = new ethers.ContractFactory(
      artifact.abi,
      artifact.bytecode,
      adminWallet
    );

    contract = await factory.deploy({ nonce: 0 });
    await contract.waitForDeployment();

    const regAuditorTx = await contract.registerUser(
      auditorWallet.address,
      "QA Auditor",
      5,
      { nonce: 1 }
    );
    await regAuditorTx.wait();
  });

  it("1. Πρέπει να ορίσει σωστά τα στατιστικά (0 εκδοθέντα, 0 ανακληθέντα)", async function () {
    const stats = await contract.connect(auditorWallet).getSystemStats();
    expect(stats[0]).to.equal(0n);
    expect(stats[1]).to.equal(0n);
  });

  it("2. Ο Admin πρέπει να μπορεί να εγγράψει νέο Issuer", async function () {
    const tx = await contract.registerUser(
      issuerWallet.address,
      "QA Issuer",
      1,
      { nonce: 2 }
    );
    await tx.wait();

    const user = await contract.users(issuerWallet.address);
    expect(user.role).to.equal(1n);
    expect(user.active).to.be.true;
  });

  it("3. Ο Issuer πρέπει να μπορεί να εκδώσει Πιστοποιητικό", async function () {
    const contractAsIssuer = contract.connect(issuerWallet);

    const tx = await contractAsIssuer.issueCertificate(
      "CERT-001",
      2,
      holderWallet.address,
      "dummy-pdf-hash-12345",
      0,
      { nonce: 0 }
    );
    await tx.wait();

    const stats = await contract.connect(auditorWallet).getSystemStats();
    expect(stats[0]).to.equal(1n);
  });

  it("4. [Security] Μη εξουσιοδοτημένος χρήστης ΔΕΝ μπορεί να διαβάσει τα System Stats", async function () {
    let errorThrown = false;
    try {
      await contract.connect(adminWallet).getSystemStats();
    } catch (err) {
      errorThrown = true;
      expect(err.message).to.include("Requires Auditor role");
    }
    expect(errorThrown).to.be.true;
  });

  it("5. [Security] Απλός χρήστης (Holder) ΔΕΝ μπορεί να εκδώσει Πιστοποιητικό", async function () {
    let errorThrown = false;
    try {
      await contract.connect(holderWallet).issueCertificate(
        "CERT-FAKE-002",
        2,
        holderWallet.address,
        "fake-hash-999",
        0,
        { nonce: 0 }
      );
    } catch (err) {
      errorThrown = true;
    }
    expect(errorThrown).to.be.true;
  });

  it("6. Ο Admin πρέπει να μπορεί να απενεργοποιήσει και να επανενεργοποιήσει χρήστη", async function () {
    let tx = await contract.deactivateUser(issuerWallet.address, { nonce: 3 });
    await tx.wait();
    let user = await contract.users(issuerWallet.address);
    expect(user.active).to.be.false;

    tx = await contract.reactivateUser(issuerWallet.address, { nonce: 4 });
    await tx.wait();
    user = await contract.users(issuerWallet.address);
    expect(user.active).to.be.true;
  });
});