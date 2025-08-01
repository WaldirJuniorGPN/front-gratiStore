FROM nginx:alpine

# Copia os arquivos estáticos para o Nginx
COPY . /usr/share/nginx/html

# Substitui a configuração padrão pelo nosso nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
