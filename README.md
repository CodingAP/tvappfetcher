# tvappfetcher

this is a deno app that will allow authenticated users to manage different channels, movies, and tv shows from an m3u/m3u8 file
they can choose the source, filter the channels accessible, request for different movies/tv shows, then output all the needed data to a linux server running jellyfin

## function 1: only let authenticated users access

### frontend
- have a login page with username and password
- go to main dashboard after successful login
- show error for unsuccessful login

### backend
- check for correct username and password
- keep user authenticated while using the app

## function 2: parse a m3u file and store all results in a sqlite db

### frontend
- paste a m3u/m3u8 link to take in
- show user the next time it will be fetched

### backend
- parse the file to get a list of channels, movies, and tv shows
```
#EXTM3U
#EXTINF:-1 xui-id="{XUI_ID}" tvg-id="" tvg-name="{NAME}" tvg-logo="{LOGO}" group-title="{TITLE}",{NAME}
https://link_to_channel.com
#EXTINF:-1 xui-id="{XUI_ID}" tvg-id="" tvg-name="{NAME}" tvg-logo="{LOGO}" group-title="{TITLE}",{NAME}
https://link_to_channel.com
#EXTINF:-1 xui-id="{XUI_ID}" tvg-id="" tvg-name="{NAME}" tvg-logo="{LOGO}" group-title="{TITLE}",{NAME}
https://link_to_channel.com
...
```
- place data in sqlite db, overwritting when needed

### function 3: choose which channels are going into the final m3u file

### frontend
- have a global list of channels that are accessible as well as filtered channels
- create a list of filters of text that has to be included

### backend
- whenever the final m3u file needs to be processed, we need to use the filters to create the list of channels
- this data comes from the sqlite db

### function 4: request movies/tv shows to be added to jellyfin

### frontend
- have a list of all tv shows/movies in the db that can be requested
- show all currently active tv shows/movies in jellyfin

### backend
- when a show is requested, create the necessary files to show it to jellyfin
  - for a movie
    - create a dir in /data/movies/{MOVIE_NAME}
    - create a file in that dir called movie.strm with the link to the movie
  - for a tv show
    - create a dir in /data/tv/{TV_NAME}
    - create a dir for each season
    - create a file in each season with the tv show name and season/episode details
- update data in db to show it has been added