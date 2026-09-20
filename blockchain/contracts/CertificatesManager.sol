// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CertificatesManager
 * @dev Manages the issuance, verification, and revocation of digital certificates.
 * Fully aligned with the .NET Backend API Contract.
 */
contract CertificatesManager {

    // ==========================================
    // ENUMS
    // ==========================================
    enum UserRole { Admin, Issuer, Holder, Verifier, RevocationOfficer, Auditor }
    enum CertificateType { Seminar, Professional, Academic, License }
    enum CertificateStatus { Active, Expired, Revoked }

    // ==========================================
    // STRUCTS
    // ==========================================
    
    /**
     * @dev Structure representing a system user.
     */
    struct User {
        address userAddress;
        string name; 
        UserRole role;
        bool active;
    }

    /**
     * @dev Structure representing a digital certificate.
     */
    struct Certificate {
        string certificateId;
        CertificateType certType;
        address issuer;
        address holder;
        string fileHash;
        uint256 issueDate;
        uint256 expiryDate;
        CertificateStatus status;
        bool revoked;
        string revocationReason;
    }

    // ==========================================
    // STATE VARIABLES & MAPPINGS
    // ==========================================
    mapping(address => User) public users;
    mapping(string => Certificate) private certificates;
    
    // Helper mappings for quick lookups
    mapping(string => string) private hashToCertId; 
    mapping(address => string[]) private holderCertificates;
    mapping(address => string[]) private issuerCertificates; 
    
    string[] public allCertificateIds; 
    
    uint256 public totalIssued;
    uint256 public totalRevoked;

    // ==========================================
    // EVENTS
    // ==========================================
    event UserRegistered(address indexed userAddress, UserRole role, string name);
    event UserRoleUpdated(address indexed userAddress, UserRole newRole);
    event UserDeactivated(address indexed userAddress);
    event UserReactivated(address indexed userAddress);
    
    event CertificateIssued(string indexed certificateId, address indexed issuer, address indexed holder, string fileHash);
    event CertificateRevoked(string indexed certificateId, address indexed revocationOfficer, string reason);
    event CertificateVerified(string indexed certificateId, address indexed verifier);

    // ==========================================
    // MODIFIERS
    // ==========================================
    
    /**
     * @dev Restricts execution to users flagged as active.
     */
    modifier onlyActiveUser() {
        require(users[msg.sender].active, "User is not active or not registered.");
        _;
    }

    modifier onlyAdmin() {
        require(users[msg.sender].role == UserRole.Admin, "Access denied: Requires Admin role.");
        _;
    }

    modifier onlyIssuer() {
        require(users[msg.sender].role == UserRole.Issuer, "Access denied: Requires Issuer role.");
        _;
    }

    modifier onlyRevocationOfficer() {
        require(users[msg.sender].role == UserRole.RevocationOfficer, "Access denied: Requires Revocation Officer role.");
        _;
    }

    modifier onlyVerifier() {
        require(users[msg.sender].role == UserRole.Verifier, "Access denied: Requires Verifier role.");
        _;
    }

    modifier onlyAuditor() {
        require(users[msg.sender].role == UserRole.Auditor, "Access denied: Requires Auditor role.");
        _;
    }

    // ==========================================
    // CONSTRUCTOR
    // ==========================================
    
    /**
     * @dev Initializes the contract and sets the deployer as the initial Admin.
     */
    constructor() {
        users[msg.sender] = User({
            userAddress: msg.sender,
            name: "System Admin",
            role: UserRole.Admin,
            active: true
        });
        emit UserRegistered(msg.sender, UserRole.Admin, "System Admin");
    }

    // ==========================================
    // USER MANAGEMENT (ADMIN ENDPOINTS)
    // ==========================================
    
    /**
     * @dev Registers a new user into the system.
     * @param _userAddress The blockchain address of the user.
     * @param _name The physical name or institution name of the user.
     * @param _role The assigned system role (e.g., Issuer, Holder).
     */
    function registerUser(address _userAddress, string memory _name, UserRole _role) public onlyActiveUser onlyAdmin {
        require(!users[_userAddress].active, "User already exists and is active.");
        users[_userAddress] = User({
            userAddress: _userAddress,
            name: _name,
            role: _role,
            active: true
        });
        emit UserRegistered(_userAddress, _role, _name);
    }

    /**
     * @dev Updates the role of an existing active user.
     * @param _userAddress The blockchain address of the user.
     * @param _newRole The new role to be assigned.
     */
    function updateUserRole(address _userAddress, UserRole _newRole) public onlyActiveUser onlyAdmin {
        require(users[_userAddress].active, "User does not exist or is inactive.");
        users[_userAddress].role = _newRole;
        emit UserRoleUpdated(_userAddress, _newRole);
    }

    /**
     * @dev Deactivates a user, preventing them from calling restricted functions.
     * @param _userAddress The blockchain address of the user to deactivate.
     */
    function deactivateUser(address _userAddress) public onlyActiveUser onlyAdmin {
        require(users[_userAddress].active, "User is already inactive.");
        users[_userAddress].active = false;
        emit UserDeactivated(_userAddress);
    }

    /**
     * @dev Reactivates a previously deactivated user.
     * @param _userAddress The blockchain address of the user to reactivate.
     */
    function reactivateUser(address _userAddress) public onlyActiveUser onlyAdmin {
        require(users[_userAddress].userAddress != address(0), "User does not exist.");
        require(!users[_userAddress].active, "User is already active.");
        users[_userAddress].active = true;
        emit UserReactivated(_userAddress);
    }

    // ==========================================
    // CERTIFICATE MANAGEMENT
    // ==========================================

    /**
     * @dev Issues a new digital certificate.
     * @param _certificateId The unique identifier of the certificate.
     * @param _certType The classification of the certificate.
     * @param _holder The blockchain address of the recipient.
     * @param _fileHash The cryptographic hash of the actual certificate document.
     * @param _expiryDate The timestamp when the certificate expires (0 if never).
     */
    function issueCertificate(
        string memory _certificateId,
        CertificateType _certType,
        address _holder,
        string memory _fileHash,
        uint256 _expiryDate
    ) public onlyActiveUser onlyIssuer {
        require(bytes(certificates[_certificateId].certificateId).length == 0, "Certificate ID already exists.");
        require(bytes(hashToCertId[_fileHash]).length == 0, "A certificate with this file hash already exists.");

        certificates[_certificateId] = Certificate({
            certificateId: _certificateId,
            certType: _certType,
            issuer: msg.sender,
            holder: _holder,
            fileHash: _fileHash,
            issueDate: block.timestamp,
            expiryDate: _expiryDate,
            status: CertificateStatus.Active,
            revoked: false,
            revocationReason: ""
        });

        hashToCertId[_fileHash] = _certificateId;
        holderCertificates[_holder].push(_certificateId);
        issuerCertificates[msg.sender].push(_certificateId);
        allCertificateIds.push(_certificateId);
        
        totalIssued++;

        emit CertificateIssued(_certificateId, msg.sender, _holder, _fileHash);
    }

    /**
     * @dev Revokes a specific certificate and records the reason.
     * @param _certificateId The unique identifier of the certificate.
     * @param _reason The justification for the revocation.
     */
    function revokeCertificate(string memory _certificateId, string memory _reason) public onlyActiveUser onlyRevocationOfficer {
        require(bytes(certificates[_certificateId].certificateId).length != 0, "Certificate does not exist.");
        require(!certificates[_certificateId].revoked, "Certificate is already revoked.");

        certificates[_certificateId].revoked = true;
        certificates[_certificateId].status = CertificateStatus.Revoked;
        certificates[_certificateId].revocationReason = _reason;

        totalRevoked++;
        emit CertificateRevoked(_certificateId, msg.sender, _reason);
    }

    /**
     * @dev Verifies a certificate by its ID and calculates dynamic expiration. Emits verification event.
     * @param _certificateId The unique identifier of the certificate.
     * @return certType The classification of the certificate.
     * @return issuer The address of the issuing entity.
     * @return holder The address of the recipient.
     * @return issueDate The timestamp of issuance.
     * @return expiryDate The timestamp of expiration.
     * @return status The dynamically calculated current status (Active, Expired, Revoked).
     * @return revocationReason The reason if the certificate was revoked.
     */
    function verifyCertificateById(string memory _certificateId) public onlyActiveUser onlyVerifier returns (
        CertificateType certType,
        address issuer,
        address holder,
        uint256 issueDate,
        uint256 expiryDate,
        CertificateStatus status,
        string memory revocationReason
    ) {
        require(bytes(certificates[_certificateId].certificateId).length != 0, "Certificate not found.");
        
        Certificate storage cert = certificates[_certificateId];
        
        CertificateStatus currentStatus = cert.status;
        if (!cert.revoked && cert.expiryDate > 0 && block.timestamp > cert.expiryDate) {
            currentStatus = CertificateStatus.Expired;
        }

        emit CertificateVerified(_certificateId, msg.sender);

        return (cert.certType, cert.issuer, cert.holder, cert.issueDate, cert.expiryDate, currentStatus, cert.revocationReason);
    }

    /**
     * @dev Read-only certificate lookup for active users (dashboards). Does not emit verification events.
     * @param _certificateId The unique identifier of the certificate.
     * @return certType The classification of the certificate.
     * @return issuer The address of the issuing entity.
     * @return holder The address of the recipient.
     * @return issueDate The timestamp of issuance.
     * @return expiryDate The timestamp of expiration.
     * @return status The dynamically calculated current status (Active, Expired, Revoked).
     * @return revocationReason The reason if the certificate was revoked.
     */
    function getCertificateDetails(string memory _certificateId) public view onlyActiveUser returns (
        CertificateType certType,
        address issuer,
        address holder,
        uint256 issueDate,
        uint256 expiryDate,
        CertificateStatus status,
        string memory revocationReason
    ) {
        require(bytes(certificates[_certificateId].certificateId).length != 0, "Certificate not found.");

        Certificate storage cert = certificates[_certificateId];

        CertificateStatus currentStatus = cert.status;
        if (!cert.revoked && cert.expiryDate > 0 && block.timestamp > cert.expiryDate) {
            currentStatus = CertificateStatus.Expired;
        }

        return (cert.certType, cert.issuer, cert.holder, cert.issueDate, cert.expiryDate, currentStatus, cert.revocationReason);
    }

    /**
     * @dev Verifies a certificate by the cryptographic hash of its file.
     * @param _fileHash The hash of the digital document.
     * @return certificateId The ID linked to this hash.
     * @return status The current status of the certificate.
     */
    function verifyCertificateByHash(string memory _fileHash) public onlyActiveUser onlyVerifier returns (
        string memory certificateId,
        CertificateStatus status
    ) {
        string memory certId = hashToCertId[_fileHash];
        require(bytes(certId).length != 0, "Certificate not found for this hash.");
        
        (,,,,, CertificateStatus currentStatus, ) = verifyCertificateById(certId);
        return (certId, currentStatus);
    }

    // ==========================================
    // GETTERS (For Backend Pagination & Filtering)
    // ==========================================

    /**
     * @dev Retrieves all certificate IDs owned by a specific holder.
     * @param _holder The address of the certificate holder.
     * @return An array of certificate IDs.
     */
    function getHolderCertificates(address _holder) public view returns (string[] memory) {
        return holderCertificates[_holder];
    }
    
    /**
     * @dev Retrieves all certificate IDs issued by a specific issuer.
     * @param _issuer The address of the issuer.
     * @return An array of certificate IDs.
     */
    function getIssuerCertificates(address _issuer) public view returns (string[] memory) {
        return issuerCertificates[_issuer];
    }

    /**
     * @dev Returns the total number of issued certificates (useful for pagination).
     * @return Total count.
     */
    function getTotalCertificatesCount() public view returns (uint256) {
        return allCertificateIds.length;
    }

    /**
     * @dev Retrieves a certificate ID by its index in the global array.
     * @param index The array index.
     * @return The certificate ID at the specified index.
     */
    function getCertificateIdByIndex(uint256 index) public view returns (string memory) {
        require(index < allCertificateIds.length, "Index out of bounds");
        return allCertificateIds[index];
    }
    
    /**
     * @dev Retrieves system-wide statistics for auditors.
     * @return _totalIssued The total number of issued certificates.
     * @return _totalRevoked The total number of revoked certificates.
     */
    function getSystemStats() public view onlyActiveUser onlyAuditor returns (uint256 _totalIssued, uint256 _totalRevoked) {
        return (totalIssued, totalRevoked);
    }
}