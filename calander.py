import datetime
import os

from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
TOKEN_PATH = "token.json"
CLIENT_SECRETS = "credentials.json"


def _load_credentials() -> Credentials:
  """Load token.json, refresh if possible, or run browser login."""
  creds = None
  if os.path.exists(TOKEN_PATH):
    creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

  if not creds or not creds.valid:
    if creds and creds.expired and creds.refresh_token:
      try:
        creds.refresh(Request())
      except RefreshError:
        creds = None
    if not creds or not creds.valid:
      flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS, SCOPES)
      creds = flow.run_local_server(port=8000)
    with open(TOKEN_PATH, "w") as token:
      token.write(creds.to_json())
  return creds


def main():
  """Shows basic usage of the Google Calendar API.
  Prints the start and name of the next 10 events on the user's calendar.
  """
  for attempt in range(2):
    creds = _load_credentials()
    try:
      service = build("calendar", "v3", credentials=creds)

      now = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
      print("Getting the upcoming 10 events")
      events_result = (
          service.events()
          .list(
              calendarId="primary",
              timeMin=now,
              maxResults=10,
              singleEvents=True,
              orderBy="startTime",
          )
          .execute()
      )
      events = events_result.get("items", [])

      if not events:
        print("No upcoming events found.")
        return

      for event in events:
        start = event["start"].get("dateTime", event["start"].get("date"))
        print(start, event["summary"])
      return
    except RefreshError:
      if attempt == 0:
        try:
          os.remove(TOKEN_PATH)
        except FileNotFoundError:
          pass
        print("Refresh token invalid or revoked; sign in again in the browser.")
        continue
      raise
    except HttpError as error:
      print(f"An error occurred: {error}")
      return


if __name__ == "__main__":
  main()