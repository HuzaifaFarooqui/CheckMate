# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /source

# Copy solution and csproj files to restore dependencies
COPY ChessApp.sln .
COPY ChessApp/*.csproj ./ChessApp/
RUN dotnet restore

# Copy all other source files
COPY . .

# Build and publish release version
RUN dotnet publish ChessApp/ChessApp.csproj -c Release -o /app --no-restore

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app .

# Expose port (Railway overrides PORT env var automatically)
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "ChessApp.dll"]
