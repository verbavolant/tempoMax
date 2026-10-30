import { expectNonEmptyString, expectObject, expectString } from '../model/validation';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';

export class DriveError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'DriveError';
    this.status = status;
  }
}

export interface DriveUser {
  displayName: string;
  emailAddress: string;
}

export async function fetchDriveUser(accessToken: string): Promise<DriveUser> {
  // `fields` è obbligatorio per about.get.
  const url = `${DRIVE_API_URL}/about?fields=${encodeURIComponent('user(displayName,emailAddress)')}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    throw new DriveError(response.status, `Google Drive ha risposto ${response.status}`);
  }
  const user = expectObject(expectObject(await response.json(), 'about').user, 'about.user');
  return {
    displayName: expectString(user.displayName, 'about.user.displayName'),
    emailAddress: expectNonEmptyString(user.emailAddress, 'about.user.emailAddress'),
  };
}
