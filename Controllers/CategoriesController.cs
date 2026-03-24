using Microsoft.AspNetCore.Mvc;

namespace MoiEx.Controllers
{
    [Route("api/[controller]")]
    public class CategoriesController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
