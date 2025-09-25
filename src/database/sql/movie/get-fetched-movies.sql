SELECT * FROM MOVIES
WHERE NAME LIKE '%' || :search || '%'
AND FETCHED = 1
LIMIT :pageSize OFFSET :offset