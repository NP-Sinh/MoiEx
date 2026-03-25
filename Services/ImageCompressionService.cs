using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Webp;
using System.IO.Compression;

namespace MoiEx.Services
{
    public interface IImageCompressionService
    {
        Task<(byte[] Data, string FileName)> CompressSingleAsync( Stream inputStream, string originalFileName, CompressionOptions options);
        Task<byte[]> CompressToZipAsync( IEnumerable<(Stream Stream, string FileName)> images, CompressionOptions options);

    }
    public class ImageCompressionService : IImageCompressionService
    {
        private static readonly HashSet<string> SupportedExtensions =
             new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };

        public async Task<(byte[] Data, string FileName)> CompressSingleAsync(
            Stream inputStream,
            string originalFileName,
            CompressionOptions options)
        {
            var (data, ext) = await CompressImageAsync(inputStream, originalFileName, options);
            var baseName = Path.GetFileNameWithoutExtension(originalFileName);
            var outName = $"{baseName}_compressed.{ext}";
            return (data, outName);
        }

        public async Task<byte[]> CompressToZipAsync(
            IEnumerable<(Stream Stream, string FileName)> images,
            CompressionOptions options)
        {
            using var zipStream = new MemoryStream();
            using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Create, leaveOpen: true))
            {
                foreach (var (stream, fileName) in images)
                {
                    var (data, ext) = await CompressImageAsync(stream, fileName, options);
                    var baseName = Path.GetFileNameWithoutExtension(fileName);
                    var entryName = $"{baseName}_compressed.{ext}";
                    var entry = archive.CreateEntry(entryName, CompressionLevel.Optimal);
                    using var entryStream = entry.Open();
                    await entryStream.WriteAsync(data);
                }
            }
            return zipStream.ToArray();
        }

        private async Task<(byte[] Data, string Extension)> CompressImageAsync(
            Stream inputStream,
            string originalFileName,
            CompressionOptions options)
        {
            var ext = Path.GetExtension(originalFileName).TrimStart('.').ToLower();
            if (!SupportedExtensions.Contains("." + ext))
                throw new NotSupportedException($"Định dạng '{ext}' không được hỗ trợ.");

            using var image = await Image.LoadAsync(inputStream);

            // Strip metadata
            if (options.StripExif)
                image.Metadata.ExifProfile = null;

            // Determine output format
            var (encoder, outExt) = ResolveEncoder(options.OutputFormat, ext, options.Quality);

            var outStream = new MemoryStream();
            await image.SaveAsync(outStream, encoder);
            return (outStream.ToArray(), outExt);
        }

        private (IImageEncoder Encoder, string Extension) ResolveEncoder(
            string outputFormat,
            string originalExt,
            int quality)
        {
            var fmt = outputFormat.ToLower();

            if (fmt == "original")
                fmt = originalExt switch
                {
                    "jpg" or "jpeg" => "jpg",
                    "png" => "png",
                    "webp" => "webp",
                    _ => "jpg"
                };

            return fmt switch
            {
                "png" => (new PngEncoder
                {
                    CompressionLevel = quality >= 80
                        ? PngCompressionLevel.BestSpeed
                        : PngCompressionLevel.BestCompression
                }, "png"),

                "webp" => (new WebpEncoder
                {
                    Quality = quality,
                    Method = WebpEncodingMethod.BestQuality
                }, "webp"),

                // Default: JPG
                _ => (new JpegEncoder { Quality = quality }, "jpg")
            };
        }
    }
    public class CompressionOptions
    {
        public int Quality { get; set; } = 80;
        public string OutputFormat { get; set; } = "jpg";
        public bool KeepOriginalSize { get; set; } = true;
        public bool StripExif { get; set; } = true;
    }

}
