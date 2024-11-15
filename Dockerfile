# Use a imagem base do Nginx
FROM nginx:alpine

# Copie os arquivos da pasta para o diretório padrão do Nginx
COPY . /usr/share/nginx/html

# Exponha a porta 80 para acessar o projeto
EXPOSE 80
