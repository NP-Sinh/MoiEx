using Microsoft.AspNetCore.Mvc;

namespace MoiEx.Controllers
{
    [Route("moiex/[controller]")]
    public class ToolsController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
