using Microsoft.AspNetCore.Mvc;

namespace MoiEx.Controllers
{
    [Route("moiex/[controller]")]
    public class CategoriesController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
