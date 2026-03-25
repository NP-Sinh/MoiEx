using Microsoft.AspNetCore.Mvc;
using MoiEx.Services;

namespace MoiEx.Controllers
{
    [Route("moiex/[controller]")]
    public class PdfConverterController : Controller
    {
        private readonly IPdfConverterServices _pdfServices;
        private const int MaxFiles = 20;
        private const long MaxFileSizeBytes = 100 * 1024 * 1024; // 100 MB

        public PdfConverterController(IPdfConverterServices pdfService)
        {
            _pdfServices = pdfService;
        }
        public IActionResult Index()
        {
            return View();
        }
        [HttpPost("convert")]
        [RequestSizeLimit(500 * 1024 * 1024)]
        public async Task<IActionResult> Convert(
            [FromForm] List<IFormFile> files,
            [FromForm] bool enableOcr = false,
            [FromForm] bool compressOutput = false,
            [FromForm] string pageOrientation = "auto")
        {
            if (files == null || files.Count == 0)
                return BadRequest("Vui lòng tải lên ít nhất 1 file.");

            if (files.Count > MaxFiles)
                return BadRequest($"Tối đa {MaxFiles} file mỗi lần.");

            foreach (var file in files)
            {
                if (file.Length > MaxFileSizeBytes)
                    return BadRequest($"File '{file.FileName}' vượt quá giới hạn 100 MB.");

                var ext = Path.GetExtension(file.FileName);
                if (!PdfConverterServices.AllSupportedExts.Contains(ext))
                    return BadRequest($"Định dạng '{ext}' của '{file.FileName}' không được hỗ trợ. " +
                                      $"Hỗ trợ: {string.Join(", ", PdfConverterServices.AllSupportedExts)}");
            }

            var options = new PdfConversionOptions
            {
                EnableOcr = enableOcr,
                CompressOutput = compressOutput,
                PageOrientation = pageOrientation
            };

            // Mở tất cả stream
            var inputs = files.Select(f => (
                Stream: (Stream)f.OpenReadStream(),
                FileName: f.FileName,
                Size: f.Length
            )).ToList();

            try
            {
                var result = await _pdfServices.ConvertAsync(inputs, options);

                return File(result.Data, result.ContentType,
                    System.Net.Http.Headers.ContentDispositionHeaderValue
                        .Parse($"attachment; filename=\"{result.FileName}\"").ToString());
            }
            finally
            {
                foreach (var (stream, _, _) in inputs)
                    await stream.DisposeAsync();
            }
        }

        // GET /api/PdfConverter/supported-formats
        [HttpGet("supported-formats")]
        public IActionResult SupportedFormats() => Ok(new
        {
            images = PdfConverterServices.ImageExts.Select(e => e.TrimStart('.')).OrderBy(e => e),
            documents = PdfConverterServices.DocExts.Concat(PdfConverterServices.TextExts)
                           .Select(e => e.TrimStart('.')).OrderBy(e => e)
        });
    }
}
