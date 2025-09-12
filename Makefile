# chemins & options
COMPOSE = docker compose -p trancs -f docker-compose.yml

# si un jour tu montes des dossiers locaux, décommente et ajuste:
# DATA_DIRS = ./backend/data

all:
	$(COMPOSE) up --build -d

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

clean: down

# full clean: supprime aussi les volumes du compose (DB/SQLite, etc.)
fclean:
	$(COMPOSE) down -v
	@rm -rf $(DATA_DIRS)

re: fclean all

.PHONY: all up down clean fclean re