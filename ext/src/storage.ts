export const getStoredAccessToken = async (): Promise<string | null> => {
  const { accessToken } = await chrome.storage.local.get("accessToken");
  return (accessToken as string | undefined) || null;
};

export const setStoredAccessToken = async (accessToken: string | null): Promise<void> => {
  await chrome.storage.local.set({ accessToken });
};

export const clearStorage = async (): Promise<void> => {
  await chrome.storage.local.remove(["accessToken"]);
};