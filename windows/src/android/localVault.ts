// Coco Squad Mobile — Local Vault Compatibility Layer
// Re-exports and bridges to the canonical vault.ts (CocoVaultDB)

export {
  type VaultRecord,
  type VaultRecord as DevouredRecord,
  computeFileHash,
  saveToVault,
  saveToVault as saveDevouredFileRecord,
  getAllFromVault,
  getAllFromVault as getDevouredRecords,
  getFromVault,
  getFromVault as getDevouredRecordById,
  deleteFromVault,
  deleteFromVault as deleteDevouredRecord,
  clearVault,
} from "./vault";
