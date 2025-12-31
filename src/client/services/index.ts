export { sseClient } from './sse';
export {
  bootstrap,
  pairWithCode,
  createBoard,

  createHorse,
  updateHorse,
  deleteHorse,
  createFeed,
  updateFeed,
  deleteFeed,
  updateTimeMode,
  updateBoard,
  createControllerToken,
  listControllerTokens,
  revokeControllerToken,
  setControllerToken,
  resolveToken,
  pollProvisioning,
  linkDevice,
  listDevices,
  listUserBoards,

  revokeDeviceToken,
  generateInviteCode,
  redeemInvite,
  loadControllerToken,
  ApiError,
} from './api';
export type { BootstrapData, PairResult, ControllerToken } from './api';
