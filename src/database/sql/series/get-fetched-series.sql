SELECT *
FROM (
    SELECT s.*,
           ROW_NUMBER() OVER (
               PARTITION BY GROUP_TITLE
               ORDER BY SEASON ASC, EPISODE ASC
           ) AS rn
    FROM SERIES s
    WHERE NAME LIKE '%' || :search || '%'
      AND FETCHED = 1
) t
WHERE rn = 1
LIMIT :pageSize OFFSET :offset;