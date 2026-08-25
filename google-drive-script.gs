// ===== Google Apps Script - Deploy this at script.google.com =====
// Steps:
// 1. Go to https://script.google.com
// 2. Click "New Project"
// 3. Delete everything in the editor and paste this entire script
// 4. Click "Deploy" → "New Deployment"
// 5. Type: Web app
// 6. Execute as: Me
// 7. Who has access: Anyone
// 8. Click "Deploy" and copy the URL
// 9. Add the URL to your .env file as GOOGLE_DRIVE_SCRIPT_URL

const FOLDER_NAME = "DashboardFiles";

function doGet(e) {
  const action = e.parameter.action;

  if (action === "list") {
    const folder = getOrCreateFolder();
    const files = folder.getFiles();
    const fileList = [];
    while (files.hasNext()) {
      const file = files.next();
      fileList.push({
        id: file.getId(),
        name: file.getName(),
        url: file.getDownloadUrl(),
        directUrl: "https://drive.google.com/uc?export=view&id=" + file.getId()
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ files: fileList })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: "Invalid action" })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { fileName, fileData, mimeType } = data;

    if (!fileName || !fileData) {
      return ContentService.createTextOutput(JSON.stringify({ error: "fileName and fileData are required" })).setMimeType(ContentService.MimeType.JSON);
    }

    const folder = getOrCreateFolder();
    const blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType || "application/octet-stream", fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const directUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      url: directUrl
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doDelete(e) {
  try {
    const fileId = e.parameter.fileId;
    if (!fileId) {
      return ContentService.createTextOutput(JSON.stringify({ error: "fileId is required" })).setMimeType(ContentService.MimeType.JSON);
    }
    DriveApp.getFileById(fileId).setTrashed(true);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOLDER_NAME);
}
