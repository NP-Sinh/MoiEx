using Microsoft.AspNetCore.Mvc;
using MoiEx.Services;

namespace MoiEx.Controllers
{
    [Route("moiex/[controller]")]
    public class ImageCompressionController : Controller
    {
        private readonly IImageCompressionService _compressionService;
        private const int MaxImages = 10;
        private const long MaxFileSizeBytes = 20 * 1024 * 1024; // 20 MB

        private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg", "image/png", "image/webp"
        };
        public ImageCompressionController(IImageCompressionService compressionService)
        {
            _compressionService = compressionService;
        }

        public IActionResult Index()
        {
            return View();
        }
        [HttpPost("compress")]
        [RequestSizeLimit(200 * 1024 * 1024)] // 200 MB
        public async Task<IActionResult> Compress(
            [FromForm] List<IFormFile> images,
            [FromForm] int quality = 80,
            [FromForm] string outputFormat = "jpg",
            [FromForm] bool keepOriginalSize = true,
            [FromForm] bool stripExif = true)
        {

            if (images == null || images.Count == 0)
                return BadRequest("Vui lòng tải lên ít nhất 1 ảnh.");

            if (images.Count > MaxImages)
                return BadRequest($"Tối đa {MaxImages} ảnh mỗi lần.");

            foreach (var file in images)
            {
                if (file.Length > MaxFileSizeBytes)
                    return BadRequest($"Ảnh '{file.FileName}' vượt quá giới hạn 20 MB.");

                if (!AllowedMimeTypes.Contains(file.ContentType))
                    return BadRequest($"Định dạng '{file.ContentType}' của '{file.FileName}' không được hỗ trợ.");
            }

            quality = Math.Clamp(quality, 10, 100);

            var options = new CompressionOptions
            {
                Quality = quality,
                OutputFormat = outputFormat,
                KeepOriginalSize = keepOriginalSize,
                StripExif = stripExif
            };

            // Single image
            if (images.Count == 1)
            {
                var file = images[0];
                await using var stream = file.OpenReadStream();
                var (data, fileName) = await _compressionService.CompressSingleAsync(stream, file.FileName, options);

                var mimeType = ResolveMimeType(outputFormat, file.ContentType);
                return File(data, mimeType, fileName);
            }

            // Multiple images → ZIP 
            var imageStreams = images.Select(f =>
            {
                return (Stream: f.OpenReadStream(), FileName: f.FileName);
            }).ToList();

            try
            {
                var zipBytes = await _compressionService.CompressToZipAsync(imageStreams, options);
                return File(zipBytes, "application/zip", "compressed_images.zip");
            }
            finally
            {
                foreach (var (stream, _) in imageStreams)
                    await stream.DisposeAsync();
            }
        }

        private static string ResolveMimeType(string outputFormat, string originalMime)
        {
            return outputFormat.ToLower() switch
            {
                "png" => "image/png",
                "webp" => "image/webp",
                "jpg" => "image/jpeg",
                "original" => originalMime,
                _ => "image/jpeg"
            };
        }

    }
}
