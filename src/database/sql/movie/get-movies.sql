SELECT * FROM MOVIES
WHERE NAME LIKE '%' || :search || '%'
LIMIT :pageSize OFFSET :offset