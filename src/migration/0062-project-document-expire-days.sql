UPDATE project_document
	SET expire_days = 90
	WHERE can_expire = 1 AND expire_days IS NULL;
