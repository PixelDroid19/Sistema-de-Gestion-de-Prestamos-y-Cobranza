const presentAuthResult = (message, result) => ({
  success: true,
  message,
  data: result,
});

const presentProfile = (user) => ({
  success: true,
  data: { user },
});

module.exports = {
  presentAuthResult,
  presentProfile,
};
