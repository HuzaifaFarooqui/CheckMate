using Microsoft.EntityFrameworkCore;
using ChessApp.Data;
using Microsoft.AspNetCore.Authentication.Cookies;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

// Configure Dynamic Database Provider
var dbProvider = builder.Configuration["DatabaseProvider"] ?? "Sqlite";
if (dbProvider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase))
{
    var connString = builder.Configuration.GetConnectionString("SqlServerConnection");
    builder.Services.AddDbContext<ChessDbContext>(options =>
        options.UseSqlServer(connString));
}
else
{
    var connString = builder.Configuration.GetConnectionString("SqliteConnection") ?? "Data Source=chess.db";
    builder.Services.AddDbContext<ChessDbContext>(options =>
        options.UseSqlite(connString));
}

// Add Session
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(60);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

// Add Cookie Authentication
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Auth/Login";
        options.LogoutPath = "/Auth/Logout";
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
    });

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
}
app.UseStaticFiles();

app.UseRouting();

app.UseSession();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// Initialize Database automatically on startup
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ChessDbContext>();
    // EnsureCreated checks if database exists. If not, it creates it and runs OnModelCreating seeds.
    dbContext.Database.EnsureCreated();
}

app.Run();
