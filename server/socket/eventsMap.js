const { getUserData } = require("./utils");

const mapIdsToUserData = async (userIdsObject) =>
  Object.fromEntries(
    userIdsObject
      ? Object.entries(userIdsObject).map(async ([key, userId]) => [
          key,
          await getUserData(userId),
        ])
      : []
  );

module.exports = {
  disconnect: null,
  userJoin: null,
  userGetData: null,
  userSetData: null,
  userSetStatus: null,
  livechatEnd: null,
  livechatUsers: null,
  messageSent: null,
  userMessage: null,
  voiceMessage: null,
  livechatRequest: mapIdsToUserData,
  livechatAccept: mapIdsToUserData,
  livechatReject: mapIdsToUserData,
  livechatTransferRequest: mapIdsToUserData,
  livechatTransferAccept: mapIdsToUserData,
  livechatTransferReject: mapIdsToUserData,
};
